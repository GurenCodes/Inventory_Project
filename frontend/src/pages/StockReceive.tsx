import { useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useForm, useWatch } from 'react-hook-form';
import type { Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { useProducts } from '../hooks/useProducts';
import { useReceiveStock } from '../hooks/useStock';
import {
  TruckIcon,
  ArrowLeftIcon,
  AlertTriangleIcon,
} from '../components/ui/Icons';

// Empty optional number inputs arrive as NaN via valueAsNumber — treat as unset
const optionalNonNegInt = (label: string) =>
  z.preprocess(
    (v) => (v === '' || v === undefined || (typeof v === 'number' && Number.isNaN(v)) ? undefined : v),
    z.number().int('Must be a whole number').min(0, `${label} cannot be negative`).optional()
  );

const receiveSchema = z
  .object({
    productId: z
      .number({ invalid_type_error: 'Select a product' })
      .int()
      .positive('Select a product'),
    crateCount: optionalNonNegInt('Crate count'),
    bottleCount: optionalNonNegInt('Bottle count'),
    costPerUnit: z
      .number({ invalid_type_error: 'Cost per unit is required' })
      .positive('Cost per unit must be greater than zero'),
    expiryDate: z.string().optional(),
  })
  .refine((data) => (data.crateCount ?? 0) > 0 || (data.bottleCount ?? 0) > 0, {
    message: 'Enter at least one crate or bottle',
    path: ['crateCount'],
  });

type ReceiveFormData = z.infer<typeof receiveSchema>;

export default function StockReceive() {
  const navigate = useNavigate();
  const { productId: productIdParam } = useParams<{ productId: string }>();
  const { data: products, isLoading } = useProducts(undefined, true);
  const receiveMutation = useReceiveStock();

  const activeProducts = (products || []).filter((p) => p.isActive);

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors },
  } = useForm<ReceiveFormData>({
    // z.preprocess widens the zod input type to unknown; output type is correct
    resolver: zodResolver(receiveSchema) as unknown as Resolver<ReceiveFormData>,
    defaultValues: {
      productId: productIdParam ? Number(productIdParam) : undefined,
      crateCount: undefined,
      bottleCount: undefined,
      costPerUnit: undefined,
      expiryDate: '',
    },
  });

  // useWatch subscribes to the field value (data, not an unstable function
  // like watch()), so React Compiler can memoize this component.
  const selectedId = useWatch({ control, name: 'productId' });
  const selectedProduct = activeProducts.find((p) => p.id === Number(selectedId));

  // Preselect the product from the URL param once. Uses the subscribed
  // `selectedId` value (not the unstable watch() function) so the effect
  // has stable dependencies and React Compiler can memoize this component.
  useEffect(() => {
    if (productIdParam && !selectedId) {
      setValue('productId', Number(productIdParam));
    }
  }, [productIdParam, selectedId, setValue]);

  const onSubmit = async (data: ReceiveFormData) => {
    try {
      await receiveMutation.mutateAsync({
        productId: data.productId,
        crateCount: data.crateCount ?? 0,
        bottleCount: data.bottleCount ?? 0,
        costPerUnit: data.costPerUnit,
        expiryDate: data.expiryDate ? new Date(data.expiryDate).toISOString() : undefined,
      });
      toast.success('Stock received');
      navigate('/stock');
    } catch (err) {
      console.error('Receive failed:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to receive stock');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse max-w-2xl">
        <div className="h-8 bg-gray-200 rounded w-64" />
        <div className="card h-96" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link
          to="/stock"
          className="p-2 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
          aria-label="Back to stock"
        >
          <ArrowLeftIcon className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="page-title mb-0">Receive Stock</h1>
          <p className="text-gray-600 mt-1">Log a delivery and update bottle and crate counts</p>
        </div>
      </div>

      <div className="card">
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="space-y-4">
            <div>
              <label htmlFor="productId" className="label-field">Product</label>
              <select
                id="productId"
                {...register('productId', { valueAsNumber: true })}
                className="select-field"
              >
                <option value="">Select a product...</option>
                {activeProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}{p.category ? ` (${p.category})` : ''}
                  </option>
                ))}
              </select>
              {errors.productId && (
                <p className="text-danger text-sm mt-1" role="alert">{errors.productId.message}</p>
              )}
            </div>

            {selectedProduct && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-700 space-y-1">
                <p>
                  <span className="text-gray-500">Current stock:</span>{' '}
                  <span className="font-medium">{selectedProduct.stock?.quantityBottles ?? 0} bottles</span>
                  {' · '}
                  <span className="font-medium">{selectedProduct.stock?.quantityCrates ?? 0} crates</span>
                </p>
                {selectedProduct.crateSize ? (
                  <p><span className="text-gray-500">Crate size:</span> {selectedProduct.crateSize} bottles per crate</p>
                ) : (
                  <p className="flex items-center gap-1 text-warning">
                    <AlertTriangleIcon className="w-4 h-4" aria-hidden="true" />
                    This product has no crate size set — crates will not be recalculated automatically.
                  </p>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="crateCount" className="label-field">Crates received</label>
                <input
                  id="crateCount"
                  type="number"
                  min={0}
                  placeholder="0"
                  {...register('crateCount', { valueAsNumber: true })}
                  className="input-field"
                />
                {errors.crateCount && (
                  <p className="text-danger text-sm mt-1" role="alert">{errors.crateCount.message}</p>
                )}
              </div>
              <div>
                <label htmlFor="bottleCount" className="label-field">Loose bottles received</label>
                <input
                  id="bottleCount"
                  type="number"
                  min={0}
                  placeholder="0"
                  {...register('bottleCount', { valueAsNumber: true })}
                  className="input-field"
                />
                {errors.bottleCount && (
                  <p className="text-danger text-sm mt-1" role="alert">{errors.bottleCount.message}</p>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="costPerUnit" className="label-field">Cost per bottle (XAF)</label>
              <input
                id="costPerUnit"
                type="number"
                min={0}
                step="any"
                placeholder="0"
                {...register('costPerUnit', { valueAsNumber: true })}
                className="input-field"
              />
              {errors.costPerUnit && (
                <p className="text-danger text-sm mt-1" role="alert">{errors.costPerUnit.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="expiryDate" className="label-field">Expiry date (optional)</label>
              <input
                id="expiryDate"
                type="date"
                {...register('expiryDate')}
                className="input-field"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 mt-6 pt-6 border-t border-gray-100">
            <Link
              to="/stock"
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              className="btn-primary"
              disabled={receiveMutation.isPending}
            >
              <TruckIcon className="w-4 h-4 mr-2" aria-hidden="true" />
              {receiveMutation.isPending ? 'Saving...' : 'Receive Stock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
