import { useEffect, useState, useCallback } from 'react'
import axios from 'axios'
import { toast } from 'react-toastify'
import { TierInfo, TaskType, Brand, User } from '@/interfaces'

export const useTaskData = () => {
  const [types, setTypes] = useState<TaskType[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [tiers, setTiers] = useState<TierInfo[]>([]) // ✅ NUEVO ESTADO
  const [loading, setLoading] = useState(true)

  // ✅ NUEVA FUNCIÓN: fetchData extraída para poder reutilizarla
  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      
      const [typesRes, brandsRes, usersRes, tiersRes] = await Promise.all([
        axios.get('/api/types'),
        axios.get('/api/brands'),
        axios.get('/api/users'),
        axios.get('/api/tiers')
      ])

      console.log('📊 Datos obtenidos del servidor:')
      console.log(`   - Types: ${typesRes.data.length}`)
      console.log(`   - Brands: ${brandsRes.data.length}`)
      console.log(`   - Users: ${usersRes.data.length}`)

      setTypes(typesRes.data)
      setBrands(brandsRes.data.filter((brand: Brand) => brand.isActive))
      setUsers(usersRes.data.filter((user: User) => user.active))
      setTiers(tiersRes.data)
      
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
      console.log('🔄 Refrescando tipos, categorías y tiers...')
      
      const [typesRes, tiersRes] = await Promise.all([
        axios.get('/api/types'),
        axios.get('/api/tiers') // ✅ NUEVA LLAMADA
      ])
      
      console.log(`📊 Types actualizados: ${typesRes.data.length}`)
      console.log(`📊 Tiers actualizados: ${tiersRes.data.length}`)
      
      setTypes(typesRes.data)
      setTiers(tiersRes.data) // ✅ NUEVO SET
      
      console.log('✅ Tipos, categorías y tiers refrescados exitosamente')
    } catch (error) {
      console.error('❌ Error al refrescar tipos:', error)
      toast.error('Error al actualizar categorías')
    }
  }, [])

  // ✅ NUEVA FUNCIÓN: Solo refrescar tiers
  const refreshTiers = useCallback(async () => {
    try {
      console.log('🔄 Refrescando solo tiers...')
      
      const tiersRes = await axios.get('/api/tiers')
      
      console.log(`📊 Tiers actualizados: ${tiersRes.data.length}`)
      setTiers(tiersRes.data)
      
      console.log('✅ Tiers refrescados exitosamente')
    } catch (error) {
      console.error('❌ Error al refrescar tiers:', error)
      toast.error('Error al actualizar tiers')
    }
  }, [])

  const refreshData = useCallback(async () => {
    console.log('🔄 Refrescando todos los datos...')
    await fetchData()
  }, [fetchData])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { 
    types, 
    brands, 
    users,
    tiers,           // ✅ NUEVO RETORNO
    loading, 
    refreshData,
    refreshTypes,
    refreshTiers     // ✅ NUEVA FUNCIÓN
  }
}