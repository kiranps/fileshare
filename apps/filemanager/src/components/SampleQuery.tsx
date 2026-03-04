import { useQuery } from '@tanstack/react-query'

function fetchGreeting() {
  return new Promise<string>((resolve) => {
    setTimeout(() => resolve('Hello from TanStack Query!'), 1000)
  })
}

export function SampleQuery() {
  const { data, isLoading } = useQuery({
    queryKey: ['greeting'],
    queryFn: fetchGreeting,
  })

  return (
    <div className="p-4 card bg-base-200 shadow-md">
      <h2 className="font-bold mb-2">React Query Demo</h2>
      {isLoading ? <span>Loading...</span> : <span>{data}</span>}
    </div>
  )
}
