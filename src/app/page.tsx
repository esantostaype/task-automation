import { CreateTaskForm } from './tasks/components/CreateTaskForm'

export default function Home() {
  return (
    <>
    <div className='flex-1 bg-surface'></div>
    <div className='w-96 p-8 h-dvh overflow-y-auto relative'>
      <CreateTaskForm />
    </div>
    </>
  )
}