import { ClickUpUsersSync } from '@/components'
import { MainTitle } from '@/components/MainTitle'
import { UserGroup03Icon } from '@hugeicons/core-free-icons'

export default function PageTaskQueue() {
  return (
    <>
      <MainTitle label="Designers" icon={ UserGroup03Icon } />
      <ClickUpUsersSync/>
    </>
  )
}