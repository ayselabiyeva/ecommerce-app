import { Controller, Get, Param } from '@nestjs/common';
import { Auth } from 'src/shared/decorators/auth.decorator';
import { RoleEnum } from 'src/shared/enums/role.enum';

@Controller('user')
export class UserController {
    constructor() { }



    @Auth(RoleEnum.USER, RoleEnum.ADMIN)
    @Get()
    async getUsers() {
        return true;
    }

}