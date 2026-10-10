import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';
import { useProducts } from '../hooks/useProducts';
import { useAdjustReorderLevel } from '../hooks/useStock';
import {
  WarehouseIcon,
  SearchIcon,
  AlertTriangleIcon,
  PlusIcon,
  XIcon,
} from '../components/ui/Icons';

type StockStatus = 'critical' | 'low' | 'ok';

function getStockStatus(bottles: number, reorderLevel: number): StockStatus {
  if (bottles === 0) return 'critical';
  if (reorderLevel > 0 && bottles <= reorderLevel) return 'low';
  return 'ok';
}

function statusBadge(status: StockStatus): string {
  switch (status) {
    case 'critical':
      return 'badge-danger';
    case 'low':
      return 'badge-warning';
    default:
      return 'badge-success';
  }
}

function statusLabel(status: StockStatus): string {
  switch (status) {
    case 'critical':
      return 'Out of stock';
    case 'low':
      return 'Low';
    default:
      return 'OK';
  }
}

export default function Stock() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [search, setSearch] = useState('');
  const [lowOnly, setLowOnly] = useState(false);
  const [reorderTarget, setReorderTarget] = useState<{
    productId: number;
    productName: string;
    currentValue: number;
  } | null>(null);
  const [reorderValue, setReorderValue] = useState('');

  const { data: products, isLoading, isError, error, refetch } = useProducts(undefined, true);
  const adjustReorder = useAdjustReorderLevel();

  const rows = useMemo(() => {
    return (products || [])
      .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
      .map((p) => {
        const bottles = p.stock?.quantityBottles ?? 0;
        const crates = p.stock?.quantityCrates ?? 0;
        const reorderLevel = p.stock?.reorderLevel ?? 0;
        return {
          product: p,
          bottles,
          crates,
          reorderLevel,
          status: getStockStatus(bottles, reorderLevel),
        };
      })
      .filter((row) => !lowOnly || row.status !== 'ok')
      .sort((a, b) => {
        const rank = { critical: 0, low: 1, ok: 2 } as const;
        if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
        return a.product.name.localeCompare(b.product.name);
      });
  }, [products, search, lowOnly]);

  const openReorderModal = (productId: number, productName: string, currentValue: number) => {
    setReorderTarget({ productId, productName, currentValue });
    setReorderValue(String(currentValue));
  };

  const saveReorderLevel = async () => {
    if (!reorderTarget) return;
    const value = parseInt(reorderValue, 10);
    if (isNaN(value) || value < 0) {
      toast.error('Reorder level must be a non-negative number');
      return;
    }
    try {
      await adjustReorder.mutateAsync({
        productId: reorderTarget.productId,
        reorderLevel: value,
      });
      toast.success(`Reorder level updated for ${reorderTarget.productName}`);
      setReorderTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update reorder level');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-48" />
        <div className="card h-16" />
        <div className="card h-64" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="card text-center py-12">
        <AlertTriangleIcon className="w-12 h-12 text-danger mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Failed to load stock</h2>
        <p className="text-gray-500 mb-4">{error instanceof Error ? error.message : 'An unexpected error occurred'}</p>
        <button onClick={() => refetch()} className="btn-primary">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Stock</h1>
          <p className="text-gray-600 mt-1">Bottle and crate levels across all products</p>
        </div>
        <Link to="/stock/receive" className="btn-primary">
          <PlusIcon className="w-4 h-4 mr-2" />
          Receive Stock
        </Link>
      </div>

      <div className="card">
        <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
          <div className="relative flex-1 max-w-xs">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" aria-hidden="true" />
            <input
              type="text"
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field pl-10"
              aria-label="Search products"
            />
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={lowOnly}
              onChange={(e) => setLowOnly(e.target.checked)}
              className="rounded border-gray-300 text-primary focus:ring-primary"
            />
            Low stock only
          </label>
        </div>
      </div>

      <div className="card">
        {rows.length > 0 ? (
          <div className="table-container">
            <table className="table-base">
              <thead className="table-header">
                <tr>
                  <th className="table-header-cell">Product</th>
                  <th className="table-header-cell">Category</th>
                  <th className="table-header-cell text-right">Bottles</th>
                  <th className="table-header-cell text-right">Crates</th>
                  <th className="table-header-cell text-right">Reorder level</th>
                  <th className="table-header-cell">Status</th>
                  <th className="table-header-cell">Actions</th>
                </tr>
              </thead>
              <tbody className="table-body divide-y divide-gray-100">
                {rows.map((row) => (
                  <tr key={row.product.id} className="hover:bg-gray-50 transition-colors duration-100 ease-out">
                    <td className="table-cell font-medium">
                      <Link to={`/products/${row.product.id}`} className="text-primary hover:text-primary-hover">
                        {row.product.name}
                      </Link>
                    </td>
                    <td className="table-cell text-gray-600">{row.product.category || '—'}</td>
                    <td className="table-cell text-right font-medium">
                      {row.status === 'critical' ? (
                        <span className="text-danger">{row.bottles}</span>
                      ) : row.status === 'low' ? (
                        <span className="text-warning">{row.bottles}</span>
                      ) : (
                        row.bottles
                      )}
                    </td>
                    <td className="table-cell text-right text-gray-600">{row.crates}</td>
                    <td className="table-cell text-right text-gray-600">{row.reorderLevel}</td>
                    <td className="table-cell">
                      <span className={statusBadge(row.status)}>{statusLabel(row.status)}</span>
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center gap-3">
                        <Link
                          to={`/stock/receive/${row.product.id}`}
                          className="text-primary hover:text-primary-hover text-sm font-medium flex items-center gap-1 transition-colors duration-150 ease-out"
                        >
                          <PlusIcon className="w-4 h-4" />
                          Receive
                        </Link>
                        {isAdmin && (
                          <button
                            onClick={() => openReorderModal(row.product.id, row.product.name, row.reorderLevel)}
                            className="text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors duration-150 ease-out"
                          >
                            Reorder level
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <WarehouseIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">No stock records found</h3>
            <p className="text-gray-500">
              {search || lowOnly ? 'Try adjusting your search or filter.' : 'Add products to start tracking stock.'}
            </p>
          </div>
        )}
      </div>

      {reorderTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Adjust reorder level">
          <div className="absolute inset-0 bg-black/40" onClick={() => setReorderTarget(null)} />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-sm p-6 animate-scale-in">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Reorder level</h2>
              <button
                onClick={() => setReorderTarget(null)}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Close dialog"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Set the reorder threshold for <span className="font-medium text-gray-900">{reorderTarget.productName}</span>.
              You will be warned when stock falls to or below this level.
            </p>
            <label className="label-field" htmlFor="reorder-level-input">Reorder level</label>
            <input
              id="reorder-level-input"
              type="number"
              min={0}
              value={reorderValue}
              onChange={(e) => setReorderValue(e.target.value)}
              className="input-field mb-4"
              autoFocus
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setReorderTarget(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-colors"
              >
                Cancel
              </button>
              <button onClick={saveReorderLevel} className="btn-primary" disabled={adjustReorder.isPending}>
                {adjustReorder.isPending ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
