const Loader = ({ message = 'Loading...' }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[200px]">
      <div className="relative w-16 h-16">
        <div className="absolute top-0 left-0 w-full h-full border-4 border-indigo-500/30 rounded-full"></div>
        <div className="absolute top-0 left-0 w-full h-full border-4 border-transparent border-t-indigo-500 rounded-full animate-spin"></div>
      </div>
      <p className="mt-4 text-slate-400">{message}</p>
    </div>
  )
}

export default Loader

