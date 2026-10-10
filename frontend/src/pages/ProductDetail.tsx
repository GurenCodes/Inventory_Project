import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';
import { useProduct, useDiscontinueProduct, useReactivateProduct } from '../hooks/useProducts';
import {
  PackageIcon,
  ArrowLeftIcon,
  EditIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  RefreshIcon,
} from '../components/ui/Icons';

export default function ProductDetail() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const productId = Number(id);
  const isAdmin = user?.role === 'ADMIN';

  const { data: product, isLoading, isError, error, refetch } = useProduct(productId);
  const discontinueMutation = useDiscontinueProduct();
  const reactivateMutation = useReactivateProduct();

  const [showConfirm, setShowConfirm] = useState<{ type: 'discontinue' | 'reactivate'; product: typeof product } | null>(null);

  const handleDiscontinue = () => product && setShowConfirm({ type: 'discontinue', product });
  const handleReactivate = () => product && setShowConfirm({ type: 'reactivate', product });

  const confirmAction = async () => {
    if (!showConfirm || !product) return;
    try {
      if (showConfirm.type === 'discontinue') {
        await discontinueMutation.mutateAsync(product.id);
        toast.success('Product discontinued');
      } else {
        await reactivateMutation.mutateAsync(product.id);
        toast.success('Product reactivated');
      }
      setShowConfirm(null);
      await refetch();
    } catch (err) {
      console.error('Action failed:', err);
      toast.error(err instanceof Error ? err.message : 'Action failed');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="flex items-center gap-4">
          <button className="btn-secondary"><ArrowLeftIcon className="w-4 h-4 mr-2" /> Back</button>
          <div className="h-8 bg-gray-200 rounded w-48" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card"><div className="h-8 bg-gray-200 rounded w-3/4 mb-2" /><div className="h-8 bg-gray-200 rounded w-1/2" /></div>
          ))}
        </div>
        <div className="card"><div className="h-32 bg-gray-200 rounded" /></div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="card text-center py-12">
        <AlertTriangleIcon className="w-12 h-12 text-danger mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Failed to load product</h2>
        <p className="text-gray-500 mb-4">{error instanceof Error ? error.message : 'An unexpected error occurred'}</p>
        <Link to="/products" className="btn-secondary mr-2"><ArrowLeftIcon className="w-4 h-4 mr-2" /> Back to Products</Link>
        <button onClick={() => refetch()} className="btn-primary"><RefreshIcon className="w-4 h-4 mr-2" /> Retry</button>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="card text-center py-12">
        <AlertTriangleIcon className="w-12 h-12 text-warning mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Product not found</h2>
        <p className="text-gray-500 mb-4">The product you're looking for doesn't exist.</p>
        <Link to="/products" className="btn-secondary"><ArrowLeftIcon className="w-4 h-4 mr-2" /> Back to Products</Link>
      </div>
    );
  }

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-CM', { style: 'currency', currency: 'XAF', minimumFractionDigits: 0 }).format(amount);

  const handleEdit = () => navigate(`/products/${product.id}/edit`);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link to="/products" className="btn-secondary">
            <ArrowLeftIcon className="w-4 h-4 mr-2" />
            Back
          </Link>
          <div>
            <h1 className="page-title">{product.name}</h1>
            <p className="text-gray-600 mt-1">{product.category || 'Uncategorized'} • {product.isActive ? 'Active' : 'Inactive'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <>
              <button onClick={handleEdit} className="btn-secondary">
                <EditIcon className="w-4 h-4 mr-2" />
                Edit
              </button>
              {product.isActive ? (
                <button
                  onClick={handleDiscontinue}
                  disabled={discontinueMutation.isPending}
                  className="btn-danger"
                >
                  {discontinueMutation.isPending ? (
                    <>
                      <div className="animate-spin -ml-1 mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                      Discontinuing...
                    </>
                  ) : (
                    <>
                      <AlertTriangleIcon className="w-4 h-4 mr-2" />
                      Discontinue
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={handleReactivate}
                  disabled={reactivateMutation.isPending}
                  className="btn-secondary"
                >
                  {reactivateMutation.isPending ? (
                    <>
                      <div className="animate-spin -ml-1 mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                      Reactivating...
                    </>
                  ) : (
                    <>
                      <CheckCircleIcon className="w-4 h-4 mr-2" />
                      Reactivate
                    </>
                  )}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Product Info Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <div className="card lg:col-span-2">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Product Image</h3>
          <div className="aspect-square bg-gray-50 rounded-lg flex items-center justify-center">
            <PackageIcon className="w-24 h-24 text-gray-300" aria-hidden="true" />
          </div>
        </div>
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Pricing</h3>
          <dl className="space-y-3">
            <div className="flex justify-between">
              <dt className="text-gray-500">Unit Price</dt>
              <dd className="font-bold text-gray-900">{formatCurrency(product.unitPrice)}</dd>
            </div>
            {product.crateSize && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Crate Size</dt>
                <dd className="font-medium text-gray-900">{product.crateSize} bottles</dd>
              </div>
            )}
          </dl>
        </div>
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Stock</h3>
          <dl className="space-y-3">
            {product.stock && (
              <>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Bottles</dt>
                  <dd className={`font-bold text-gray-900 ${product.stock.quantityBottles <= (product.stock.reorderLevel || 0) ? 'text-warning' : ''}`}>
                    {product.stock.quantityBottles}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Crates</dt>
                  <dd className="font-medium text-gray-900">{product.stock.quantityCrates}</dd>
                </div>
                {product.stock.reorderLevel > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Reorder Level</dt>
                    <dd className="font-medium text-gray-900">{product.stock.reorderLevel}</dd>
                  </div>
                )}
                {product.stock.reorderLevel > 0 && product.stock.quantityBottles <= product.stock.reorderLevel && (
                  <div className="flex items-center gap-2 text-warning text-sm">
                    <AlertTriangleIcon className="w-4 h-4 flex-shrink-0" />
                    <span>Below reorder level</span>
                  </div>
                )}
              </>
            )}
          </dl>
        </div>
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Details</h3>
          <dl className="space-y-3">
            <div>
              <dt className="text-gray-500 text-sm">Status</dt>
              <dd className="mt-1">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  product.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                }`}>
                  {product.isActive ? 'Active' : 'Inactive'}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-gray-500 text-sm">Category</dt>
              <dd className="mt-1 text-gray-900">{product.category || 'Uncategorized'}</dd>
            </div>
            <div>
              <dt className="text-gray-500 text-sm">Crate size</dt>
              <dd className="mt-1 text-gray-900 text-sm">{product.crateSize ? `${product.crateSize} bottles` : 'Not set'}</dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 animate-scale-in">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {showConfirm.type === 'discontinue' ? 'Discontinue Product' : 'Reactivate Product'}
            </h3>
            <p className="text-gray-600 mb-4">
              {showConfirm.type === 'discontinue'
                ? `Are you sure you want to discontinue "${product.name}"? It will no longer appear in the active catalog, but all history will be preserved.`
                : `Are you sure you want to reactivate "${product.name}"? It will become available for sales again.`}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowConfirm(null)}
                disabled={discontinueMutation.isPending || reactivateMutation.isPending}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={confirmAction}
                disabled={discontinueMutation.isPending || reactivateMutation.isPending}
                className={showConfirm.type === 'discontinue' ? 'btn-danger' : 'btn-primary'}
              >
                {discontinueMutation.isPending || reactivateMutation.isPending ? 'Processing...' : (showConfirm.type === 'discontinue' ? 'Discontinue' : 'Reactivate')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}