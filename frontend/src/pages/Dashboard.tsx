import { useDashboardData, LowStockItem, RecentSale } from '../hooks/useDashboard';
import {
  PackageIcon,
  AlertTriangleIcon,
  DollarSignIcon,
  TruckIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  EyeIcon,
  DownloadIcon,
  RefreshIcon,
} from '../components/ui/Icons';

const statCards = [
  {
    name: 'Total Products',
    icon: PackageIcon,
    iconColor: 'text-primary',
    iconBg: 'bg-primary/10',
  },
  {
    name: 'Low Stock Items',
    icon: AlertTriangleIcon,
    iconColor: 'text-warning',
    iconBg: 'bg-warning/10',
  },
  {
    name: "Today's Sales",
    icon: DollarSignIcon,
    iconColor: 'text-success',
    iconBg: 'bg-success/10',
  },
  {
    name: 'Critical Alerts',
    icon: TruckIcon,
    iconColor: 'text-danger',
    iconBg: 'bg-danger/10',
  },
] as const;

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-CM', {
    style: 'currency',
    currency: 'XAF',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getStatusBadgeClass(status: string): string {
  switch (status.toLowerCase()) {
    case 'completed':
      return 'badge-success';
    case 'pending':
      return 'badge-warning';
    case 'cancelled':
      return 'badge-danger';
    default:
      return 'badge-gray';
  }
}

function getStockStatusClass(status: string): string {
  switch (status) {
    case 'critical':
      return 'badge-danger';
    case 'low':
      return 'badge-warning';
    default:
      return 'badge-success';
  }
}

function getStockStatusLabel(status: string): string {
  switch (status) {
    case 'critical':
      return 'Critical';
    case 'low':
      return 'Low';
    default:
      return 'OK';
  }
}

export default function Dashboard() {
  const { stats, lowStock, recentSales, isLoading, isError, error, refetch } = useDashboardData();

  if (isLoading) {
    return (
      <div className="space-y-8 animate-pulse">
        <div>
          <div className="h-8 bg-gray-200 rounded w-48 mb-2" />
          <div className="h-4 bg-gray-200 rounded w-64" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card">
              <div className="flex items-center justify-between">
                <div>
                  <div className="h-4 bg-gray-200 rounded w-32 mb-2" />
                  <div className="h-8 bg-gray-200 rounded w-24" />
                </div>
                <div className="w-12 h-12 bg-gray-200 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="card">
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
                      {[...Array(3)].map((_, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="table-cell"><div className="h-4 bg-gray-200 rounded w-32" /></td>
                          <td className="table-cell"><div className="h-4 bg-gray-200 rounded w-24" /></td>
                          <td className="table-cell text-right"><div className="h-4 bg-gray-200 rounded w-16" /></td>
                          <td className="table-cell text-right"><div className="h-4 bg-gray-200 rounded w-16" /></td>
                          <td className="table-cell"><div className="h-4 bg-gray-200 rounded w-20" /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
          <div className="lg:col-span-3">
            <div className="card">
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
                      {[...Array(3)].map((_, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="table-cell"><div className="h-4 bg-gray-200 rounded w-24" /></td>
                          <td className="table-cell"><div className="h-4 bg-gray-200 rounded w-32" /></td>
                          <td className="table-cell"><div className="h-4 bg-gray-200 rounded w-16" /></td>
                          <td className="table-cell text-right"><div className="h-4 bg-gray-200 rounded w-20" /></td>
                          <td className="table-cell"><div className="h-4 bg-gray-200 rounded w-16" /></td>
                          <td className="table-cell"><div className="h-4 bg-gray-200 rounded w-24" /></td>
                          <td className="table-cell"><div className="h-4 bg-gray-200 rounded w-12" /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="card text-center py-12">
        <ExclamationCircleIcon className="w-12 h-12 text-danger mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Failed to load dashboard</h2>
        <p className="text-gray-500 mb-4">{error instanceof Error ? error.message : 'An unexpected error occurred'}</p>
        <button
          onClick={refetch}
          className="btn-primary"
        >
          <RefreshIcon className="w-4 h-4 mr-2" />
          Retry
        </button>
      </div>
    );
  }

  const totalProducts = stats?.totalProducts ?? 0;
  const lowStockCount = stats?.lowStockCount ?? 0;
  const todaySalesAmount = stats?.todaySalesAmount ?? 0;
  const criticalAlertsCount = stats?.lowStockAlertsCount ?? 0;

  const statValues = [totalProducts, lowStockCount, formatCurrency(todaySalesAmount), criticalAlertsCount];

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="text-gray-600 mt-1">Welcome back! Here's an overview of your inventory.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={refetch} className="btn-secondary" aria-label="Refresh data">
            <RefreshIcon className="w-4 h-4 mr-2" />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card, index) => (
          <div key={card.name} className="card hover:shadow-md transition-shadow duration-200 ease-out">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-500 truncate">{card.name}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {statValues[index] ?? '—'}
                </p>
              </div>
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${card.iconBg}`}>
                <card.icon className={`w-6 h-6 ${card.iconColor}`} aria-hidden="true" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Low Stock & Recent Sales */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Low Stock Alerts */}
        <div className="lg:col-span-2">
          <div className="card">
            <div className="card-header flex flex-wrap items-center justify-between gap-4">
              <h2 className="text-lg font-semibold text-gray-900">Low Stock Alerts</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={refetch}
                  className="btn-secondary text-sm py-1.5 px-3"
                  aria-label="Refresh low stock data"
                >
                  <RefreshIcon className="w-4 h-4 mr-2" />
                  Refresh
                </button>
              </div>
            </div>
            <div className="card-body">
              {lowStock && lowStock.length > 0 ? (
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
                    <tbody className="table-body divide-y divide-gray-100">
                      {lowStock.map((item: LowStockItem) => (
                        <tr key={item.productId} className="hover:bg-gray-50 transition-colors duration-100 ease-out">
                          <td className="table-cell font-medium">{item.productName}</td>
                          <td className="table-cell text-gray-600">{item.category || '—'}</td>
                          <td className="table-cell text-right font-medium">
                            {item.status === 'critical' ? (
                              <span className="text-danger">{item.quantityBottles}</span>
                            ) : item.status === 'low' ? (
                              <span className="text-warning">{item.quantityBottles}</span>
                            ) : (
                              item.quantityBottles
                            )}
                          </td>
                          <td className="table-cell text-right text-gray-500">{item.reorderLevel}</td>
                          <td className="table-cell">
                            <span className={getStockStatusClass(item.status)}>
                              {getStockStatusLabel(item.status)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8">
                  <CheckCircleIcon className="w-12 h-12 text-success mx-auto mb-3" />
                  <p className="text-gray-500">No low stock items. All products are well-stocked.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Recent Sales */}
        <div className="lg:col-span-3">
          <div className="card">
            <div className="card-header flex flex-wrap items-center justify-between gap-4">
              <h2 className="text-lg font-semibold text-gray-900">Recent Sales</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={refetch}
                  className="btn-secondary text-sm py-1.5 px-3"
                  aria-label="Refresh sales data"
                >
                  <RefreshIcon className="w-4 h-4 mr-2" />
                  Refresh
                </button>
                <button className="btn-secondary text-sm py-1.5 px-3" aria-label="Export sales data">
                  <DownloadIcon className="w-4 h-4 mr-2" />
                  Export
                </button>
              </div>
            </div>
            <div className="card-body">
              {recentSales && recentSales.length > 0 ? (
                <div className="table-container">
                  <table className="table-base">
                    <thead className="table-header">
                      <tr>
                        <th className="table-header-cell">Sale ID</th>
                        <th className="table-header-cell">Sold By</th>
                        <th className="table-header-cell">Items</th>
                        <th className="table-header-cell text-right">Total</th>
                        <th className="table-header-cell">Status</th>
                        <th className="table-header-cell">Date</th>
                        <th className="table-header-cell">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="table-body divide-y divide-gray-100">
                      {recentSales.map((sale: RecentSale) => (
                        <tr key={sale.id} className="hover:bg-gray-50 transition-colors duration-100 ease-out">
                          <td className="table-cell font-mono text-sm">#{sale.id.toString().padStart(5, '0')}</td>
                          <td className="table-cell">{sale.soldByName}</td>
                          <td className="table-cell text-gray-600">{sale.itemCount} item{sale.itemCount !== 1 ? 's' : ''}</td>
                          <td className="table-cell text-right font-medium">{formatCurrency(sale.totalAmount)}</td>
                          <td className="table-cell">
                            <span className={getStatusBadgeClass(sale.status)}>
                              {sale.status.charAt(0).toUpperCase() + sale.status.slice(1)}
                            </span>
                          </td>
                          <td className="table-cell text-gray-500 text-sm">{formatDate(sale.createdAt)}</td>
                          <td className="table-cell">
                            <button
                              className="text-primary hover:text-primary-hover text-sm font-medium flex items-center gap-1 transition-colors duration-150 ease-out"
                              aria-label={`View sale #${sale.id}`}
                            >
                              <EyeIcon className="w-4 h-4" />
                              View
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <DollarSignIcon className="w-6 h-6 text-gray-400" />
                  </div>
                  <p className="text-gray-500">No sales recorded yet.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}