const color = ''
const size = 'xs'

const params = new URLSearchParams();

if(color) params.append('color', color)
if(size) params.append('size', size)

const url = `http://localhost:3000/api/product/filter?${params.toString()}`

console.log(url);


const scroll = window.scrollY()

// if(scroll > 150)    