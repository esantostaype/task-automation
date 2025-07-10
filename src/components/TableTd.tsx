interface Props {
  children: React.ReactNode
}

export const TableTd = ({ children }: Props ) => {
  return <td className="p-2">{ children }</td>
}