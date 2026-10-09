import { useAuth } from '../../hooks/useAuth';

export default function Dashboard() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7v10l8 4" />
                </svg>
              </div>
              <span className="text-xl font-bold text-gray-900">Floramagg Inventory</span>
            </div>
            <nav className="flex items-center gap-4">
              <a href="/" className="text-sm font-medium text-gray-700 hover:text-primary transition-colors">Dashboard</a>
              <a href="/products" className="text-sm font-medium text-gray-700 hover:text-primary transition-colors">Products</a>
              <a href="/stock" className="text-sm font-medium text-gray-700 hover:text-primary transition-colors">Stock</a>
              <a href="/sales" className="text-sm font-medium text-gray-700 hover:text-primary transition-colors">Sales</a>
              <a href="/reports" className="text-sm font-medium text-gray-700 hover:text-primary transition-colors">Reports</a>
              <div className="w-px h-6 bg-gray-200 mx-2"></div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Manager</span>
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-sm font-medium">
                  M
                </div>
                <button className="btn-secondary text-sm py-1.5 px-3">Logout</button>
              </div>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="page-title">Dashboard</h1>
          <p className="text-gray-600 mt-1">Welcome back! Here's an overview of your inventory.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Total Products</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">124</p>
              </div>
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7v10l8 4" />
                </svg>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Low Stock Items</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">7</p>
              </div>
              <div className="w-12 h-12 bg-warning/10 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.833 1.732 2.833h16.536c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-.833-1.964-.833-2.732 0z" />
                </svg>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Today's Sales</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">FCFA 124,500</p>
              </div>
              <div className="w-12 h-12 bg-success/10 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3-2 1.343-2 3-2-.895-2-3-2-.895-2-3-2-1.343-2-3-2zm0 4c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3-2 1.343-2 3-2-.895-2-3-2-1.343-2-3-2z" />
                </svg>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Low Stock Alerts</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">3</p>
              </div>
              <div className="w-12 h-12 bg-danger/10 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-danger" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.833 1.732 2.833h16.536c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-.833-1.964-.833-2.732 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="card">
              <div className="card-header">
                <h2 className="text-lg font-semibold text-gray-900">Low Stock Alerts</h2>
              </div>
              <div className="card-body">
                <div className="table-container">
                  <table className="table-base">
                    <thead className="table-header">
                      <tr>
                        <th className="table-header-cell">Product</th>
                        <th className="table-header-cell">Category</th>
                        <th className="table-header-cell text-right">Current Stock</th>
                        <th className="table-header-cell text-right">Reorder Level</th>
                        <th className="table-header-cell">Status</th>
                      </tr>
                    </thead>
                    <tbody className="table-body">
                      <tr className="hover:bg-gray-50">
                        <td className="table-cell font-medium">Mango Juice 1L</td>
                        <td className="table-cell">Juice</td>
                        <td className="table-cell text-right text-danger font-medium">3</td>
                        <td className="table-cell text-right">20</td>
                        <td className="table-cell"><span className="badge badge-danger">Critical</span></td>
                      </tr>
                      <tr className="hover:bg-gray-50">
                        <td className="table-cell font-medium">Orange Juice 500ml</td>
                        <td className="table-cell">Juice</td>
                        <td className="table-cell text-right text-warning font-medium">12</td>
                        <td className="table-cell text-right">15</td>
                        <td className="table-cell"><span className="badge badge-warning">Low</span></td>
                      </tr>
                      <tr className="hover:bg-gray-50">
                        <td className="table-cell font-medium">Pineapple Juice 1L</td>
                        <td className="table-cell">Juice</td>
                        <td className="table-cell text-right text-warning font-medium">8</td>
                        <td className="table-cell text-right">10</td>
                        <td className="table-cell"><span className="badge badge-warning">Low</span></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-3">
            <div className="card">
              <div className="card-header flex flex-wrap items-center justify-between gap-4">
                <h2 className="text-lg font-semibold text-gray-900">Low Stock Alerts</h2>
                <div className="flex items-center gap-2">
                  <select className="input-field w-auto">
                    <option>Today</option>
                    <option>This Week</option>
                    <option>This Month</option>
                  </select>
                  <button className="btn-secondary text-sm py-1.5 px-3">Export</button>
                </div>
              </div>
              <div className="card-body">
                <div className="table-container">
                  <table className="table-base">
                    <thead className="table-header">
                      <tr>
                        <th className="table-header-cell">Sale ID</th>
                        <th className="table-header-cell">Customer</th>
                        <th className="table-header-cell">Items</th>
                        <th className="table-header-cell text-right">Total</th>
                        <th className="table-header-cell">Status</th>
                        <th className="table-header-cell">Date</th>
                        <th className="table-header-cell">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="table-body">
                      <tr className="hover:bg-gray-50">
                        <td className="table-cell font-mono text-sm">#SAL-001</td>
                        <td className="table-cell">Le Bon Goût Restaurant</td>
                        <td className="table-cell">12 items</td>
                        <td className="table-cell text-right font-medium">FCFA 125,500</td>
                        <td className="table-cell"><span className="badge badge-success">Completed</span></td>
                        <td className="table-cell text-gray-500 text-sm">Oct 9, 2026 10:30</td>
                        <td className="table-cell"><button className="text-primary hover:text-primary-hover text-sm font-medium">View</button></td>
                      </tr>
                      <tr className="hover:bg-gray-50">
                        <td className="table-cell font-mono text-sm">#SAL-002</td>
                        <td className="table-cell">Super Marché Yaoundé</td>
                        <td className="table-cell">8 items</td>
                        <td className="table-cell text-right font-medium">FCFA 89,200</td>
                        <td className="table-cell"><span className="badge badge-success">Completed</span></td>
                        <td className="table-cell text-gray-500 text-sm">Oct 9, 2026 09:15</td>
                        <td className="table-cell"><button className="text-primary hover:text-primary-hover text-sm font-medium">View</button></td>
                      </tr>
                      <tr className="hover:bg-gray-50">
                        <td className="table-cell font-mono text-sm">#SAL-003</td>
                        <td className="table-cell">Bistro Le Gourmet</td>
                        <td className="table-cell">5 items</td>
                        <td className="table-cell text-right font-medium">FCFA 45,750</td>
                        <td className="table-cell"><span className="badge badge-warning">Pending</span></td>
                        <td className="table-cell text-gray-500 text-sm">Oct 9, 2026 08:45</td>
                        <td className="table-cell"><button className="text-primary hover:text-primary-hover text-sm font-medium">View</button></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default Dashboard;