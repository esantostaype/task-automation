import { useEffect, useState } from 'react'
import axios from 'axios'
import { toast } from 'react-toastify'
import { TaskType, Brand, User } from '@/interfaces'

export const useTaskData = () => {
  const [types, setTypes] = useState<TaskType[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [typesRes, brandsRes, usersRes] = await Promise.all([
          axios.get('/api/types'),
          axios.get('/api/brands'),
          axios.get('/api/users')
        ])

        setTypes(typesRes.data)
        setBrands(brandsRes.data.filter((brand: Brand) => brand.isActive))
        setUsers(usersRes.data.filter((user: User) => user.active))
      } catch (error) {
        toast.error(`Error al cargar datos: ${error}`)
      } finally {
        setLoading(false)
      }
    }
    
    fetchData()
  }, [])

  return { types, brands, users, loading }
}