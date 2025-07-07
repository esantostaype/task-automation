import { ClickUpUsersSync } from '@/components'
import { UserGroup03Icon } from '@hugeicons/core-free-icons'
import { MainTitle } from '@/components/MainTitle'

export default function PageDesigners() {
  return (
    <>
      <MainTitle title="Designers" icon={ UserGroup03Icon } />
      <ClickUpUsersSync/>
    </>
  )
}