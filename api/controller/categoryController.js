import Category from "../../models/categoryModel.js"

export const createCategory = async (req, res) => {

    try {
        const product = req.body
        const { name } = product
        const categoryExist = await Category.findOne({name})
        if(categoryExist){
            return res.status(400).json({msg: 'Category already exist'})
        }
       const newCategory = await Category.create(product)

       return res.json(newCategory)
    } catch (error) {
        
        return res.status(500).json({ message : "Category creation failed", error})
        
    }
}

export const getCategories = async (req, res) => {
    try {
      const categories = await Category.find()
      
      if(!categories){
        return res.status(404).json({message: 'Category not found'})
      }
      return res.json(categories)

    } catch (error) {
      return res.status(500).json({ message: "Internal server error", error })  
    }
}
export const updateCategory = async (req,res) => {
    try {
        const { id } = req.params
        const { name } = req.body

      const updatedCategory = await Category.findByIdAndUpdate(id, { name }, { new: true })
      
      if(!updatedCategory){
        return res.status(404).json({ message: 'Category not found' })
      }
      return res.json(updatedCategory)
    } catch (error) {
        console.log(error)
        return res.status(500).json({ message: "Internal server error",error})
    }
}

export const deleteCategory = async (req, res) => {
    try {
       const { id } = req.params
       const categoryExist = await Category.findById(id)
       if(!categoryExist){
        return res.status(404).json({ message: 'Category not found' })
       }
       const response = await Category.findByIdAndDelete(id)
       return res.json(response)
    } catch (error) {
        
    }
}