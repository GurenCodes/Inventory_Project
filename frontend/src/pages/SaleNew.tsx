import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useProducts } from '../hooks/useProducts';
import { useCreateSale, CreateSaleItem } from '../hooks/useSales';
import { formatCurrency } from '../lib/format';
import {
  ShoppingCartIcon,
  PlusIcon,
  XIcon,
  AlertTriangleIcon,
  ArrowLeftIcon,
} from '../components/ui/Icons';

interface CartLine {
  productId: number;
  productName: string;
  unitPrice: number;
  quantityBottles: number;
  available: number;
}

export default function SaleNew() {
  const navigate = useNavigate();
  const { data: products, isLoading } = useProducts(undefined, false);
  const createSale = useCreateSale();

  const activeProducts = useMemo(
    () => (products || []).filter((p) => p.isActive),
    [products]
  );

  const [selectedId, setSelectedId] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('1');
  const [cart, setCart] = useState<CartLine[]>([]);

  const selectedProduct = activeProducts.find((p) => p.id === Number(selectedId));

  const total = cart.reduce((sum, line) => sum + line.unitPrice * line.quantityBottles, 0);

  const addToCart = () => {
    const product = selectedProduct;
    if (!product) {
      toast.error('Select a product first');
      return;
    }
    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty <= 0) {
      toast.error('Quantity must be a positive whole number');
      return;
    }

    const available = product.stock?.quantityBottles ?? 0;
    const existing = cart.find((line) => line.productId === product.id);
    const alreadyInCart = existing?.quantityBottles ?? 0;

    if (available === 0) {
      toast.error(`${product.name} is out of stock`);
      return;
    }
    if (alreadyInCart + qty > available) {
      toast.error(`Only ${available - alreadyInCart} bottle${available - alreadyInCart !== 1 ? 's' : ''} of ${product.name} available`);
      return;
    }

    if (existing) {
      setCart((prev) =>
        prev.map((line) =>
          line.productId === product.id
            ? { ...line, quantityBottles: line.quantityBottles + qty }
            : line
        )
      );
    } else {
      setCart((prev) => [
        ...prev,
        {
          productId: product.id,
          productName: product.name,
          unitPrice: Number(product.unitPrice),
          quantityBottles: qty,
          available,
        },
      ]);
    }

    setSelectedId('');
    setQuantity('1');
  };

  const removeFromCart = (productId: number) => {
    setCart((prev) => prev.filter((line) => line.productId !== productId));
  };

  const handleSubmit = async () => {
    if (cart.length === 0) {
      toast.error('Add at least one item to the sale');
      return;
    }
    const items: CreateSaleItem[] = cart.map((line) => ({
      productId: line.productId,
      quantityBottles: line.quantityBottles,
    }));
    try {
      const sale = await createSale.mutateAsync(items);
      toast.success('Sale completed');
      navigate(`/sales/${sale.id}`);
    } catch (err) {
      console.error('Sale failed:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to complete sale');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse max-w-3xl">
        <div className="h-8 bg-gray-200 rounded w-48" />
        <div className="card h-40" />
        <div className="card h-48" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Link
          to="/sales"
          className="p-2 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
          aria-label="Back to sales"
        >
          <ArrowLeftIcon className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="page-title mb-0">New Sale</h1>
          <p className="text-gray-600 mt-1">Add bottles and complete the checkout</p>
        </div>
      </div>

      <div className="space-y-6">
        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-semibold text-gray-900">Add items</h2>
          </div>
          <div className="card-body">
            <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
              <div className="flex-1">
                <label htmlFor="product-select" className="label-field">Product</label>
                <select
                  id="product-select"
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value)}
                  className="select-field"
                >
                  <option value="">Select a product...</option>
                  {activeProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {formatCurrency(p.unitPrice)}
                      {p.stock ? ` (${p.stock.quantityBottles} in stock)` : ' (no stock)'}
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-full sm:w-28">
                <label htmlFor="qty-input" className="label-field">Bottles</label>
                <input
                  id="qty-input"
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="input-field"
                />
              </div>
              <button onClick={addToCart} className="btn-primary sm:mb-0">
                <PlusIcon className="w-4 h-4 mr-2" />
                Add
              </button>
            </div>
            {selectedProduct && selectedProduct.stock?.quantityBottles === 0 && (
              <p className="text-warning text-sm mt-3 flex items-center gap-1" role="alert">
                <AlertTriangleIcon className="w-4 h-4" aria-hidden="true" />
                {selectedProduct.name} is out of stock.
              </p>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-semibold text-gray-900">Cart</h2>
          </div>
          <div className="card-body">
            {cart.length > 0 ? (
              <>
                <div className="table-container">
                  <table className="table-base">
                    <thead className="table-header">
                      <tr>
                        <th className="table-header-cell">Product</th>
                        <th className="table-header-cell text-right">Qty</th>
                        <th className="table-header-cell text-right">Unit price</th>
                        <th className="table-header-cell text-right">Subtotal</th>
                        <th className="table-header-cell"><span className="sr-only">Remove</span></th>
                      </tr>
                    </thead>
                    <tbody className="table-body divide-y divide-gray-100">
                      {cart.map((line) => (
                        <tr key={line.productId} className="hover:bg-gray-50 transition-colors duration-100 ease-out">
                          <td className="table-cell font-medium">{line.productName}</td>
                          <td className="table-cell text-right">{line.quantityBottles}</td>
                          <td className="table-cell text-right text-gray-600">{formatCurrency(line.unitPrice)}</td>
                          <td className="table-cell text-right font-medium">
                            {formatCurrency(line.unitPrice * line.quantityBottles)}
                          </td>
                          <td className="table-cell text-right">
                            <button
                              onClick={() => removeFromCart(line.productId)}
                              className="text-gray-400 hover:text-danger transition-colors"
                              aria-label={`Remove ${line.productName} from cart`}
                            >
                              <XIcon className="w-5 h-5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                  <span className="text-sm text-gray-500">
                    {cart.length} line{cart.length !== 1 ? 's' : ''}
                  </span>
                  <span className="text-xl font-bold text-gray-900">Total: {formatCurrency(total)}</span>
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <ShoppingCartIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">Cart is empty. Add products to start a sale.</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          <Link
            to="/sales"
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-colors"
          >
            Cancel
          </Link>
          <button
            onClick={handleSubmit}
            className="btn-secondary"
            disabled={createSale.isPending || cart.length === 0}
          >
            <ShoppingCartIcon className="w-4 h-4 mr-2" />
            {createSale.isPending ? 'Processing...' : `Complete Sale — ${formatCurrency(total)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
