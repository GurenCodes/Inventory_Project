import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSales } from '../hooks/useSales';
import { useAuth } from '../hooks/useAuth';
import { formatCurrency, formatDate, formatSaleId, saleStatusBadge } from '../lib/format';
import {
  ShoppingCartIcon,
  PlusIcon,
  EyeIcon,
  AlertTriangleIcon,
  RefreshIcon,
} from '../components/ui/Icons';

const statusOptions = [
  { value: '', label: 'All statuses' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
] as const;

export default function Sales() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [status, setStatus] = useState('');
  const { data: sales, isLoading, isError, error, refetch } = useSales(status || undefined);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Sales</h1>
          <p className="text-gray-600 mt-1">Record and review sales transactions</p>
        </div>
        <button onClick={() => navigate('/sales/new')} className="btn-secondary">
          <PlusIcon className="w-4 h-4 mr-2" />
          New Sale
        </button>
      </div>

      <div className="card">
        <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
          <div className="relative">
            <label htmlFor="status-filter" className="sr-only">Filter by status</label>
            <select
              id="status-filter"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="select-field w-auto pr-10"
            >
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => refetch()}
            className="btn-secondary text-sm py-1.5 px-3 sm:ml-auto"
            aria-label="Refresh sales"
          >
            <RefreshIcon className="w-4 h-4 mr-2" />
            Refresh
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="card animate-pulse h-64" />
      ) : isError ? (
        <div className="card text-center py-12">
          <AlertTriangleIcon className="w-12 h-12 text-danger mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Failed to load sales</h2>
          <p className="text-gray-500 mb-4">{error instanceof Error ? error.message : 'An unexpected error occurred'}</p>
          <button onClick={() => refetch()} className="btn-primary">
            <RefreshIcon className="w-4 h-4 mr-2" />
            Retry
          </button>
        </div>
      ) : (
        <div className="card">
          {sales && sales.length > 0 ? (
            <div className="table-container">
              <table className="table-base">
                <thead className="table-header">
                  <tr>
                    <th className="table-header-cell">Sale ID</th>
                    <th className="table-header-cell">Sold By</th>
                    <th className="table-header-cell text-right">Items</th>
                    <th className="table-header-cell text-right">Total</th>
                    <th className="table-header-cell">Status</th>
                    <th className="table-header-cell">Date</th>
                    <th className="table-header-cell">Actions</th>
                  </tr>
                </thead>
                <tbody className="table-body divide-y divide-gray-100">
                  {sales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-gray-50 transition-colors duration-100 ease-out">
                      <td className="table-cell font-mono text-sm">{formatSaleId(sale.id)}</td>
                      <td className="table-cell">{sale.soldBy?.fullName || `User #${sale.soldById}`}</td>
                      <td className="table-cell text-right text-gray-600">
                        {sale.items?.length ?? 0} item{(sale.items?.length ?? 0) !== 1 ? 's' : ''}
                      </td>
                      <td className="table-cell text-right font-medium">{formatCurrency(sale.totalAmount)}</td>
                      <td className="table-cell">
                        <span className={saleStatusBadge(sale.status)}>
                          {sale.status.charAt(0).toUpperCase() + sale.status.slice(1)}
                        </span>
                      </td>
                      <td className="table-cell text-gray-500 text-sm">{formatDate(sale.createdAt)}</td>
                      <td className="table-cell">
                        <Link
                          to={`/sales/${sale.id}`}
                          className="text-primary hover:text-primary-hover text-sm font-medium flex items-center gap-1 transition-colors duration-150 ease-out"
                        >
                          <EyeIcon className="w-4 h-4" />
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <ShoppingCartIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-gray-900 mb-1">No sales found</h3>
              <p className="text-gray-500 mb-4">
                {status ? 'No sales match the selected status.' : `Welcome, ${user?.fullName}. Record your first sale to get started.`}
              </p>
              <button onClick={() => navigate('/sales/new')} className="btn-secondary">
                <PlusIcon className="w-4 h-4 mr-2" />
                New Sale
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
