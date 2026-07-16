import { Search } from 'lucide-react'

interface Props {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

/** 帶放大鏡 icon 的受控搜尋框（過濾邏輯由呼叫端做）。 */
export function SearchBar({ value, onChange, placeholder = '搜尋病患姓名、病患編號' }: Props) {
  return (
    <div className="relative w-full max-w-md">
      <Search
        size={17}
        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-bark-300"
      />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input pl-10"
      />
    </div>
  )
}
