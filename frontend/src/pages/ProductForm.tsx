import { useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';
import { useProduct, useCreateProduct, useUpdateProduct } from '../hooks/useProducts';
import {
  ArrowLeftIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
} from '../components/ui/Icons';

const productSchema = z.object({
  name: z.string().min(1, 'Product name is required').max(255, 'Name too long'),
  category: z.string().optional().nullable(),
  unitPrice: z.number().positive('Unit price must be positive'),
  crateSize: z.number().int('Crate size must be a whole number').positive('Crate size must be positive').optional().nullable(),
  reorderLevel: z.number().min(0, 'Reorder level must be non-negative').optional().nullable(),
});

type ProductFormData = z.infer<typeof productSchema>;

export default function ProductForm() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const productId = id ? Number(id) : null;
  const isAdmin = user?.role === 'ADMIN';

  const { data: product, isLoading: loadingProduct, isError: productError } = useProduct(productId!);

  const createMutation = useCreateProduct();
  const updateMutation = useUpdateProduct();

  const isSubmitting = isEdit ? updateMutation.isPending : createMutation.isPending;

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting: isFormSubmitting },
    reset,
  } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: '',
      category: '',
      unitPrice: 0,
      crateSize: undefined,
      reorderLevel: undefined,
    },
  });

  // useWatch subscribes to field values (returns data, not an unstable
  // function like watch()), so React Compiler can memoize this component
  // and the preview never renders stale values.
  const formValues = useWatch({ control });

  // Initialize form with product data when editing (in an effect, not during render)
  useEffect(() => {
    if (isEdit && product) {
      reset({
        name: product.name,
        category: product.category || '',
        unitPrice: Number(product.unitPrice),
        crateSize: product.crateSize || undefined,
        reorderLevel: product.stock?.reorderLevel ?? undefined,
      });
    }
  }, [isEdit, product, reset]);

  if (!isAdmin) {
    return (
      <div className="card text-center py-12">
        <AlertTriangleIcon className="w-12 h-12 text-danger mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Access Denied</h2>
        <p className="text-gray-500 mb-4">Only administrators can create or edit products.</p>
        <Link to="/products" className="btn-secondary">
          <ArrowLeftIcon className="w-4 h-4 mr-2" />
          Back to Products
        </Link>
      </div>
    );
  }

  if (isEdit && loadingProduct) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 animate-pulse">
        <div className="flex items-center gap-4">
          <Link to="/products" className="btn-secondary"><ArrowLeftIcon className="w-4 h-4 mr-2" /> Back</Link>
          <div className="h-8 bg-gray-200 rounded w-48" />
        </div>
        <div className="card"><div className="h-8 bg-gray-200 rounded w-3/4 mb-4" /><div className="h-8 bg-gray-200 rounded w-1/2" /></div>
      </div>
    );
  }

  if (isEdit && productError) {
    return (
      <div className="max-w-2xl mx-auto card text-center py-12">
        <AlertTriangleIcon className="w-12 h-12 text-danger mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Failed to load product</h2>
        <Link to="/products" className="btn-secondary"><ArrowLeftIcon className="w-4 h-4 mr-2" /> Back to Products</Link>
      </div>
    );
  }

  const onSubmit = async (data: ProductFormData) => {
    try {
      if (isEdit && productId) {
        await updateMutation.mutateAsync({ id: productId, data });
        toast.success('Product updated');
      } else {
        await createMutation.mutateAsync(data);
        toast.success('Product created');
      }
      navigate('/products');
    } catch (err) {
      console.error('Submit error:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to save product');
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/products" className="btn-secondary">
          <ArrowLeftIcon className="w-4 h-4 mr-2" />
          Back
        </Link>
        <div>
          <h1 className="page-title">{isEdit ? 'Edit Product' : 'Create Product'}</h1>
          <p className="text-gray-600 mt-1">{isEdit ? 'Update product details' : 'Add a new product to the catalog'}</p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="card space-y-6" noValidate>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label htmlFor="name" className="label-field">Product Name *</label>
            <input
              id="name"
              type="text"
              placeholder="e.g., Mango Juice 1L"
              {...register('name')}
              className={`input-field mt-1 ${errors.name ? 'border-danger focus:ring-danger' : ''}`}
              aria-invalid={errors.name ? 'true' : 'false'}
              disabled={isSubmitting}
            />
            {errors.name && (
              <p className="mt-1 text-sm text-danger flex items-center gap-1">
                <AlertTriangleIcon className="w-4 h-4 flex-shrink-0" />
                {errors.name.message}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="category" className="label-field">Category</label>
            <select
              id="category"
              {...register('category')}
              className="input-field mt-1"
              disabled={isSubmitting}
            >
              <option value="">Select category</option>
              <option value="Juice">Juice</option>
              <option value="Water">Water</option>
              <option value="Soda">Soda</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div>
            <label htmlFor="unitPrice" className="label-field">Unit Price (XAF) *</label>
            <input
              id="unitPrice"
              type="number"
              step="1"
              min="1"
              placeholder="e.g., 500"
              {...register('unitPrice', { valueAsNumber: true })}
              className={`input-field mt-1 ${errors.unitPrice ? 'border-danger focus:ring-danger' : ''}`}
              aria-invalid={errors.unitPrice ? 'true' : 'false'}
              disabled={isSubmitting}
            />
            {errors.unitPrice && (
              <p className="mt-1 text-sm text-danger flex items-center gap-1">
                <AlertTriangleIcon className="w-4 h-4 flex-shrink-0" />
                {errors.unitPrice.message}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="crateSize" className="label-field">Crate Size (bottles)</label>
            <input
              id="crateSize"
              type="number"
              step="1"
              min="1"
              placeholder="e.g., 12"
              {...register('crateSize', { valueAsNumber: true })}
              className={`input-field mt-1 ${errors.crateSize ? 'border-danger focus:ring-danger' : ''}`}
              aria-invalid={errors.crateSize ? 'true' : 'false'}
              disabled={isSubmitting}
            />
            {errors.crateSize && (
              <p className="mt-1 text-sm text-danger flex items-center gap-1">
                <AlertTriangleIcon className="w-4 h-4 flex-shrink-0" />
                {errors.crateSize.message}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="reorderLevel" className="label-field">Reorder Level (bottles)</label>
            <input
              id="reorderLevel"
              type="number"
              step="1"
              min="0"
              placeholder="e.g., 20"
              {...register('reorderLevel', { valueAsNumber: true })}
              className={`input-field mt-1 ${errors.reorderLevel ? 'border-danger focus:ring-danger' : ''}`}
              aria-invalid={errors.reorderLevel ? 'true' : 'false'}
              disabled={isSubmitting}
            />
            {errors.reorderLevel && (
              <p className="mt-1 text-sm text-danger flex items-center gap-1">
                <AlertTriangleIcon className="w-4 h-4 flex-shrink-0" />
                {errors.reorderLevel.message}
              </p>
            )}
          </div>
        </div>

        {/* Preview */}
        <div className="border-t border-gray-200 pt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Preview</h3>
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-500">Name</span>
              <span className="font-medium">{formValues.name || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Category</span>
              <span className="font-medium">{formValues.category || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Unit Price</span>
              <span className="font-medium">
                {formValues.unitPrice
                  ? new Intl.NumberFormat('en-CM', { style: 'currency', currency: 'XAF', minimumFractionDigits: 0 }).format(formValues.unitPrice)
                  : '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Crate Size</span>
              <span className="font-medium">{formValues.crateSize ? `${formValues.crateSize} bottles` : 'Not set'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Reorder Level</span>
              <span className="font-medium">{formValues.reorderLevel ? `${formValues.reorderLevel} bottles` : 'Not set'}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-end border-t border-gray-200 pt-6">
          <Link to="/products" className="btn-secondary">
            <ArrowLeftIcon className="w-4 h-4 mr-2" />
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting || isFormSubmitting}
            className="btn-primary"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin -ml-1 mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                {isEdit ? 'Saving...' : 'Creating...'}
              </>
            ) : (
              <>
                <CheckCircleIcon className="w-4 h-4 mr-2" />
                {isEdit ? 'Save Changes' : 'Create Product'}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}