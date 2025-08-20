import { ConflictException, Injectable, NotFoundException, ParseEnumPipe } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ProductEntity } from 'src/entities/Products.entity';
import { In, Repository } from 'typeorm';
import { ProductCreateDto } from './dto/create.dto';
import CategoryEntity from 'src/entities/Category.entity';
import UploadEntity from 'src/entities/Upload.entity';
import { ProductUpdateDto } from './dto/update.dto';
import BrandEntity from 'src/entities/Brand.entity';
import { PaginationQueryDto } from './dto/paginate.dto';
import { FilterProductsDto } from './dto/filter.dto';

@Injectable()
export class ProductService {
    constructor(
        @InjectRepository(ProductEntity)
        private productRepo: Repository<ProductEntity>,
        @InjectRepository(CategoryEntity)
        private categoryRepo: Repository<CategoryEntity>,
        @InjectRepository(UploadEntity)
        private uploadRepo: Repository<UploadEntity>,
        @InjectRepository(BrandEntity)
        private brandRepo: Repository<BrandEntity>
    ) { }


    async getAllProducts() {
        let products = await this.productRepo.find({
            select: {
                name: true,
                description: true,
                price: true,
                stock: true,
                category: {
                    name: true,
                    id: true,
                    slug: true
                },
                id: true,
                colors: true,
                sizes: true,
                slug: true,
                createdAt: true,
                updatedAt: true
            },
            relations: ['category', 'images', 'brand']
        })
        return products
    }


    async getPaginatedProducts(params: PaginationQueryDto) {
        const page = params.page ?? 1;
        const limit = params.limit ?? 10;

        const skip = (page - 1) * limit;

        const [products, total] = await this.productRepo.findAndCount({
            skip,
            take: limit,
        });

        return {
            data: products,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }


    async getProductById(id: number) {
        let product = await this.productRepo.findOne({
            where: { id },
            select: {
                name: true,
                description: true,
                price: true,
                stock: true,
                category: {
                    name: true,
                    id: true,
                    slug: true
                },
                images: true,
                id: true,
                colors: true,
                sizes: true,
                slug: true,
                createdAt: true,
                updatedAt: true
            },
            relations: ['category', 'images', 'brand'],
        })
        if (!product) throw new NotFoundException("Product is not found with given id!")
        return product
    }


    async filterProducts(params: FilterProductsDto) {
        const queryBuilder = this.productRepo.createQueryBuilder('product');

        if (params.brandId) {
            queryBuilder.andWhere('product.brandId = :brandId', { brandId: params.brandId });
        }

        if (params.colors && params.colors.length > 0) {
            queryBuilder.andWhere('product.colors && :colors', { colors: params.colors });
        }

        if (params.sizes && params.sizes.length > 0) {
            queryBuilder.andWhere('product.sizes && :sizes', { sizes: params.sizes });
        }

        if (params.minPrice && params.maxPrice) {
            queryBuilder.andWhere('product.price BETWEEN :minPrice AND :maxPrice', {
                minPrice: params.minPrice,
                maxPrice: params.maxPrice
            });
        } else if (params.minPrice) {
            queryBuilder.andWhere('product.price >= :minPrice', { minPrice: params.minPrice });
        } else if (params.maxPrice) {
            queryBuilder.andWhere('product.price <= :maxPrice', { maxPrice: params.maxPrice });
        }

        const products = await queryBuilder.getMany();

        if (!products || products.length === 0) {
            throw new NotFoundException("Products not found with given parameters");
        }

        return products;
    }

    async create(params: ProductCreateDto) {

        let category = await this.categoryRepo.findOne({ where: { id: params.categoryId }, select: { id: true } })

        if (!category) throw new NotFoundException("Category is not found with given id!")

        let brand = await this.brandRepo.findOne({ where: { id: params.brandId }, select: { id: true } })

        if (!brand) throw new NotFoundException("Brand is not found with given id!")

        const uploads = await this.uploadRepo.find({
            where: { id: In(params.images) }
        })

        if (!uploads.length) throw new NotFoundException("Image is not found with given id!")

        if (params.slug) {

            let checkedProduct = await this.productRepo.findOne({ where: { slug: params.slug }, select: { id: true } })

            if (checkedProduct) throw new ConflictException("Product has already exsist woth given slug")

        } else {
            let editedSlug = this.slugify(params.name)

            let checkedProduct = await this.productRepo.findOne({ where: { slug: editedSlug }, select: { id: true } })

            if (checkedProduct) throw new ConflictException("Product has already exsist with given slug")
        }


        let product = this.productRepo.create({
            name: params.name,
            description: params.description,
            categoryId: params.categoryId,
            brandId: params.brandId,
            price: params.price,
            sizes: params.sizes,
            colors: params.colors,
            images: uploads,
            slug: params.slug ? params.slug : this.slugify(params.name)
        });

        await this.productRepo.save(product);
        return product

    }

    slugify(text: string) {
        return text
            .toString()
            .toLowerCase()
            .trim()
            .replace(/\s+/g, '-')
            .replace(/[^\w\-]+/g, '')
            .replace(/\-\-+/g, '-')
    }


    async getProductByCategoryId(id: number) {
    const category = await this.categoryRepo.findOne({ 
        where: { id }, 
        select: { id: true } 
    });

    if (!category) {
        throw new NotFoundException("Category is not found with given id!");
    }

    const categoryIds = await this.getAllSubCategoryIds(id);

    const products = await this.productRepo.find({
        where: { 
            categoryId: In(categoryIds) 
        },
        select: {
            id: true,
            name: true,
            description: true,
            price: true,
            stock: true,
            colors: true,
            sizes: true,
            slug: true,
            createdAt: true,
            updatedAt: true,
            images: true,
            category: {
                id: true,
                name: true,
                slug: true
            },
            brand: {
                id: true,
                name: true,
                slug: true
            }
        },
        relations: ['category', 'brand', 'images']
    });

    if (!products || products.length === 0) {
        throw new NotFoundException("No products found for the given category and its subcategories!");
    }

    return products;
}

    private async getAllSubCategoryIds(parentId: number): Promise<number[]> {
    const categoryIds = [parentId]; 

    const findSubCategories = async (currentParentId: number): Promise<void> => {
        const subCategories = await this.categoryRepo.find({
            where: { parentId: currentParentId },
            select: { id: true }
        });
        
        for (const subCategory of subCategories) {
            categoryIds.push(subCategory.id);
            await findSubCategories(subCategory.id);
        }
    };

    await findSubCategories(parentId);
    return categoryIds;
    }


    async update(params: ProductUpdateDto, id: number) {
        let product = await this.productRepo.findOne({ where: { id } })

        if (!product) throw new NotFoundException("Product is not found with given id!")

        if (params.categoryId) {
            let category = await this.categoryRepo.findOne({ where: { id }, select: { id: true } })

            if (!category) throw new NotFoundException("Category is not found with given id!")
        }

        if (params.brandId) {
            let brand = await this.brandRepo.findOne({ where: { id: params.brandId }, select: { id: true } })

            if (!brand) throw new NotFoundException("Brand is not found with given id!")
        }

        Object.assign(product, {
            ...params,
            name: params.name ?? product.name,
            description: params.description ?? product.description,
            categoryId: params.categoryId ?? product.categoryId,
            colors: params.colors ?? product.colors,
            sizes: params.sizes ?? product.sizes,
            images: params.images ?? product.images,
            price: params.price ?? product.price,
            slug: params.slug ?? product.slug,
            stock: params.stock ?? product.stock,
            brandId: params.brandId ?? product.brandId
        })

        await product.save()
        return {
            message: "Product updated successfully",
            product
        }

    }



    async deleteProduct(id: number) {

        let product = await this.productRepo.findOne({ where: { id } })

        if (!product) throw new NotFoundException("Product is not found with given id!")

        await this.productRepo.delete(id)

        return {
            message: "Product deleted seccessfully!"
        }
    }




}


