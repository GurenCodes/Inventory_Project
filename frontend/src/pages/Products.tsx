import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useProducts } from '../hooks/useProducts';
import {
  PackageIcon,
  PlusIcon,
  SearchIcon,
  FilterIcon,
  AlertTriangleIcon,
  RefreshIcon,
} from '../components/ui/Icons';

const categories = ['All', 'Juice', 'Water', 'Soda', 'Other'] as const;

export default function Products() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'ADMIN';
  const [category, setCategory] = useState<string>('All');
  const [search, setSearch] = useState('');

  const { data: products, isLoading, isError, error, refetch } = useProducts(
    category === 'All' ? undefined : category,
    false
  );

  const filteredProducts = products?.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const handleCreate = () => navigate('/products/new');
  const handleView = (id: number) => navigate(`/products/${id}`);

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="h-8 bg-gray-200 rounded w-48" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card">
              <div className="h-32 bg-gray-200 rounded mb-3" />
              <div className="h-5 bg-gray-200 rounded w-3/4 mb-2" />
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-2" />
              <div className="h-4 bg-gray-200 rounded w-1/4" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="card text-center py-12">
        <AlertTriangleIcon className="w-12 h-12 text-danger mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Failed to load products</h2>
        <p className="text-gray-500 mb-4">{error instanceof Error ? error.message : 'An unexpected error occurred'}</p>
        <button onClick={() => refetch()} className="btn-primary">
          <RefreshIcon className="w-4 h-4 mr-2" />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Products</h1>
          <p className="text-gray-600 mt-1">Manage your product catalog</p>
        </div>
        {isAdmin && (
          <button onClick={handleCreate} className="btn-primary">
            <PlusIcon className="w-4 h-4 mr-2" />
            Add Product
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-xs">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" aria-hidden="true" />
            <input
              type="text"
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field pl-10"
            />
          </div>
          <div className="relative">
            <FilterIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" aria-hidden="true" />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="input-field pr-10 pl-10 appearance-none"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Product Grid */}
      {filteredProducts.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredProducts.map((product) => (
            <article
              key={product.id}
              className="card hover:shadow-md transition-shadow duration-200 ease-out"
              onClick={() => handleView(product.id)}
              style={{ cursor: 'pointer' }}
            >
              <div className="aspect-square bg-gray-50 rounded-lg mb-3 flex items-center justify-center">
                <PackageIcon className="w-12 h-12 text-gray-300" aria-hidden="true" />
              </div>
              <h3 className="font-medium text-gray-900 truncate mb-1">{product.name}</h3>
              <p className="text-sm text-gray-500 mb-2">{product.category || 'Uncategorized'}</p>
              <div className="flex items-center justify-between">
                <span className="text-lg font-bold text-gray-900">
                  {new Intl.NumberFormat('en-CM', { style: 'currency', currency: 'XAF', minimumFractionDigits: 0 }).format(product.unitPrice)}
                </span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  product.isActive
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {product.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              {product.stock && (
                <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500">
                  <span>Stock: {product.stock.quantityBottles} bottles</span>
                  {product.stock.reorderLevel > 0 && product.stock.quantityBottles <= product.stock.reorderLevel && (
                    <AlertTriangleIcon className="w-4 h-4 text-warning" aria-hidden="true" />
                  )}
                </div>
              )}
            </article>
          ))}
        </div>
      ) : (
        <div className="card text-center py-12">
          <PackageIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">No products found</h3>
          <p className="text-gray-500 mb-4">
            {search || category !== 'All'
              ? 'Try adjusting your search or filter criteria.'
              : 'Get started by adding your first product.'}
          </p>
          {isAdmin && (
            <button onClick={handleCreate} className="btn-primary">
              <PlusIcon className="w-4 h-4 mr-2" />
              Add Product
            </button>
          )}
        </div>
      )}
    </div>
  );
}