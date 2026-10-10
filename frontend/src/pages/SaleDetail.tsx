import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useSale, useCancelSale } from '../hooks/useSales';
import { useAuth } from '../hooks/useAuth';
import { formatCurrency, formatDate, formatSaleId, saleStatusBadge } from '../lib/format';
import {
  ArrowLeftIcon,
  AlertTriangleIcon,
  RefreshIcon,
  XIcon,
  DollarSignIcon,
} from '../components/ui/Icons';

export default function SaleDetail() {
  const { id } = useParams<{ id: string }>();
  const saleId = Number(id);
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const { data: sale, isLoading, isError, error, refetch } = useSale(saleId);
  const cancelSale = useCancelSale();
  const [showCancel, setShowCancel] = useState(false);

  const confirmCancel = async () => {
    try {
      await cancelSale.mutateAsync(saleId);
      toast.success('Sale cancelled and stock restored');
      setShowCancel(false);
      await refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to cancel sale');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse max-w-4xl">
        <div className="h-8 bg-gray-200 rounded w-48" />
        <div className="card h-48" />
        <div className="card h-64" />
      </div>
    );
  }

  if (isError || !sale) {
    return (
      <div className="card text-center py-12 max-w-4xl">
        <AlertTriangleIcon className="w-12 h-12 text-danger mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Failed to load sale</h2>
        <p className="text-gray-500 mb-4">{error instanceof Error ? error.message : `Sale ${id} not found`}</p>
        <button onClick={() => refetch()} className="btn-primary">
          <RefreshIcon className="w-4 h-4 mr-2" />
          Retry
        </button>
      </div>
    );
  }

  const canCancel = isAdmin && sale.status === 'completed';

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          to="/sales"
          className="p-2 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
          aria-label="Back to sales"
        >
          <ArrowLeftIcon className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="page-title mb-0 flex items-center gap-3">
            Sale {formatSaleId(sale.id)}
            <span className={saleStatusBadge(sale.status)}>
              {sale.status.charAt(0).toUpperCase() + sale.status.slice(1)}
            </span>
          </h1>
          <p className="text-gray-600 mt-1">Placed by {sale.soldBy?.fullName || `User #${sale.soldById}`} on {formatDate(sale.createdAt)}</p>
        </div>
        {canCancel && (
          <button onClick={() => setShowCancel(true)} className="btn-danger">
            Cancel Sale
          </button>
        )}
      </div>

      <div className="card flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">Total amount</p>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(sale.totalAmount)}</p>
        </div>
        <div className="text-right text-sm text-gray-500">
          <p>{sale.items.length} line item{sale.items.length !== 1 ? 's' : ''}</p>
          <p>
            {sale.items.reduce((sum, item) => sum + item.quantityBottles, 0)} bottle
            {sale.items.reduce((sum, item) => sum + item.quantityBottles, 0) !== 1 ? 's' : ''} total
          </p>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="text-lg font-semibold text-gray-900">Items</h2>
        </div>
        <div className="card-body">
          {sale.items.length > 0 ? (
            <div className="table-container">
              <table className="table-base">
                <thead className="table-header">
                  <tr>
                    <th className="table-header-cell">Product</th>
                    <th className="table-header-cell text-right">Quantity</th>
                    <th className="table-header-cell text-right">Unit price</th>
                    <th className="table-header-cell text-right">Line total</th>
                  </tr>
                </thead>
                <tbody className="table-body divide-y divide-gray-100">
                  {sale.items.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50 transition-colors duration-100 ease-out">
                      <td className="table-cell font-medium">
                        {item.product ? (
                          <Link to={`/products/${item.product.id}`} className="text-primary hover:text-primary-hover">
                            {item.product.name}
                          </Link>
                        ) : (
                          `Product #${item.productId}`
                        )}
                      </td>
                      <td className="table-cell text-right">{item.quantityBottles}</td>
                      <td className="table-cell text-right text-gray-600">{formatCurrency(item.unitPrice)}</td>
                      <td className="table-cell text-right font-medium">{formatCurrency(item.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50">
                    <td className="px-3 py-3 text-sm font-semibold text-gray-900" colSpan={3}>Total</td>
                    <td className="px-3 py-3 text-sm font-bold text-gray-900 text-right">{formatCurrency(sale.totalAmount)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <div className="text-center py-8">
              <DollarSignIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No items recorded for this sale.</p>
            </div>
          )}
        </div>
      </div>

      {showCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Cancel sale confirmation">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowCancel(false)} />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-sm p-6 animate-scale-in">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Cancel sale?</h2>
              <button onClick={() => setShowCancel(false)} className="text-gray-400 hover:text-gray-600" aria-label="Close dialog">
                <XIcon className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              This will mark sale {formatSaleId(sale.id)} as cancelled and return{' '}
              {sale.items.reduce((sum, item) => sum + item.quantityBottles, 0)} bottle
              {sale.items.reduce((sum, item) => sum + item.quantityBottles, 0) !== 1 ? 's' : ''} to stock.
              This cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowCancel(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-colors"
              >
                Keep Sale
              </button>
              <button onClick={confirmCancel} className="btn-danger" disabled={cancelSale.isPending}>
                {cancelSale.isPending ? 'Cancelling...' : 'Cancel Sale'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
