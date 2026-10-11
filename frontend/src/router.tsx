import { createBrowserRouter, createRoutesFromElements, Route } from 'react-router-dom';
import Layout from './components/layout/Layout';
import ProtectedRoute from './components/auth/ProtectedRoute';
import {
  LazyPage,
  Login,
  Dashboard,
  Products,
  ProductDetail,
  ProductForm,
  Stock,
  StockReceive,
  Sales,
  SaleDetail,
  SaleNew,
  Reports,
  Users,
} from './routes/pages';

export const router = createBrowserRouter(
  createRoutesFromElements(
    <>
      {/* Login sits outside the authenticated layout */}
      <Route path="/login" element={<LazyPage><Login /></LazyPage>} />
      <Route path="/" element={<Layout />}>
        <Route element={<ProtectedRoute allowedRoles={['ADMIN', 'MANAGER']} />}>
          <Route index element={<LazyPage><Dashboard /></LazyPage>} />
          <Route path="products" element={<LazyPage><Products /></LazyPage>} />
          <Route path="products/new" element={<LazyPage><ProductForm /></LazyPage>} />
          <Route path="products/:id" element={<LazyPage><ProductDetail /></LazyPage>} />
          <Route path="products/:id/edit" element={<LazyPage><ProductForm /></LazyPage>} />
          <Route path="stock" element={<LazyPage><Stock /></LazyPage>} />
          <Route path="stock/receive" element={<LazyPage><StockReceive /></LazyPage>} />
          <Route path="stock/receive/:productId" element={<LazyPage><StockReceive /></LazyPage>} />
          <Route path="sales" element={<LazyPage><Sales /></LazyPage>} />
          <Route path="sales/new" element={<LazyPage><SaleNew /></LazyPage>} />
          <Route path="sales/:id" element={<LazyPage><SaleDetail /></LazyPage>} />
          <Route path="reports" element={<LazyPage><Reports /></LazyPage>} />
        </Route>
        <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
          <Route path="users" element={<LazyPage><Users /></LazyPage>} />
        </Route>
      </Route>
    </>
  )
);

export default router;
