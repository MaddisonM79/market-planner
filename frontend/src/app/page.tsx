export default function Home() {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
          Welcome to Market Manager
        </h1>
        <p className="mt-6 text-lg leading-8 text-gray-600">
          Your comprehensive platform for market management, inventory tracking, and cost calculation.
        </p>
      </div>
      
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 mt-12">
        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-lg font-semibold mb-2">Inventory Management</h3>
          <p className="text-gray-600">
            Track your materials, components, and finished products with ease.
          </p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-lg font-semibold mb-2">Cost Calculation</h3>
          <p className="text-gray-600">
            Calculate labor costs, material expenses, and manufacturing overhead.
          </p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-lg font-semibold mb-2">Sales Management</h3>
          <p className="text-gray-600">
            Manage your product catalog and generate market sheets.
          </p>
        </div>
      </div>
    </div>
  )
}