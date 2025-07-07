import { useEffect, useState, useCallback } from 'react'
import axios from 'axios'
import { toast } from 'react-toastify'
import { TaskType, Brand, User } from '@/interfaces'

export const useTaskData = () => {
  const [types, setTypes] = useState<TaskType[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  // ✅ NUEVA FUNCIÓN: fetchData extraída para poder reutilizarla
  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      
      const [typesRes, brandsRes, usersRes] = await Promise.all([
        axios.get('/api/types'),
        axios.get('/api/brands'),
        axios.get('/api/users')
      ])

      console.log('📊 Datos obtenidos del servidor:')
      console.log(`   - Types: ${typesRes.data.length}`)
      console.log(`   - Brands: ${brandsRes.data.length}`)
      console.log(`   - Users: ${usersRes.data.length}`)

      setTypes(typesRes.data)
      setBrands(brandsRes.data.filter((brand: Brand) => brand.isActive))
      setUsers(usersRes.data.filter((user: User) => user.active))
      
    } catch (error) {
      console.error('❌ Error al cargar datos:', error)
      toast.error(`Error al cargar datos: ${error}`)
    } finally {
      setLoading(false)
    }
  }, [])

  // ✅ NUEVA FUNCIÓN: Solo actualizar types/categories
  const refreshTypes = useCallback(async () => {
    try {
      console.log('🔄 Refrescando solo tipos y categorías...')
      
      const typesRes = await axios.get('/api/types')
      
      console.log(`📊 Types actualizados: ${typesRes.data.length}`)
      setTypes(typesRes.data)
      
      console.log('✅ Tipos y categorías refrescados exitosamente')
    } catch (error) {
      console.error('❌ Error al refrescar tipos:', error)
      toast.error('Error al actualizar categorías')
    }
  }, [])

  // ✅ NUEVA FUNCIÓN: refreshData completo para actualizar todo
  const refreshData = useCallback(async () => {
    console.log('🔄 Refrescando todos los datos...')
    await fetchData()
  }, [fetchData])

  // ✅ Cargar datos inicialmente
  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { 
    types, 
    brands, 
    users, 
    loading, 
    refreshData,     // ✅ Refresh completo
    refreshTypes     // ✅ Refresh solo de categorías (más eficiente)
  }
}