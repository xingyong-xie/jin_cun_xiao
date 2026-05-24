import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu } from 'antd';
import {
  DashboardOutlined, ShoppingOutlined,
  ShoppingCartOutlined, AppstoreOutlined,
  UserOutlined, LogoutOutlined,
  TeamOutlined, ContainerOutlined
} from '@ant-design/icons';
import PrivateRoute from './components/PrivateRoute';
import { getUser, isAdmin, logout } from './utils/auth';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import SupplierList from './pages/purchase/SupplierList';
import PurchaseOrderList from './pages/purchase/PurchaseOrderList';
import PurchaseOrderForm from './pages/purchase/PurchaseOrderForm';
import CustomerList from './pages/sales/CustomerList';
import SalesOrderList from './pages/sales/SalesOrderList';
import SalesOrderForm from './pages/sales/SalesOrderForm';
import ProductList from './pages/inventory/ProductList';
import StockOverview from './pages/inventory/StockOverview';
import StockAlert from './pages/inventory/StockAlert';
import UserManagement from './pages/settings/UserManagement';

const { Header, Sider, Content } = Layout;

const menuItems = [
  { key: '/', icon: <DashboardOutlined />, label: '首页' },
  {
    key: 'purchase', icon: <ShoppingOutlined />, label: '进货管理',
    children: [
      { key: '/purchase/suppliers', icon: <TeamOutlined />, label: '供应商管理' },
      { key: '/purchase/orders', icon: <ShoppingCartOutlined />, label: '进货单' },
    ]
  },
  {
    key: 'sales', icon: <ContainerOutlined />, label: '销货管理',
    children: [
      { key: '/sales/customers', icon: <TeamOutlined />, label: '客户管理' },
      { key: '/sales/in-stock-orders', icon: <ShoppingCartOutlined />, label: '现货单' },
      { key: '/sales/pre-orders', icon: <ShoppingCartOutlined />, label: '订货单' },
    ]
  },
  {
    key: 'inventory', icon: <AppstoreOutlined />, label: '存货管理',
    children: [
      { key: '/inventory/products', label: '商品管理' },
      { key: '/inventory/overview', label: '库存概览' },
      { key: '/inventory/alerts', label: '库存预警' },
    ]
  },
];

function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = getUser();

  const allMenuItems = isAdmin()
    ? [...menuItems, { key: '/settings/users', icon: <UserOutlined />, label: '用户管理' }]
    : menuItems;

  const handleMenuClick = ({ key }) => {
    navigate(key);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const selectedKeys = [location.pathname];
  const openKeys = menuItems
    .filter(item => item.children?.some(child => location.pathname.startsWith(child.key)))
    .map(item => item.key);

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider width={200} theme="dark">
        <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 18, fontWeight: 'bold' }}>
          进销存管理
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={selectedKeys}
          defaultOpenKeys={openKeys}
          items={allMenuItems}
          onClick={handleMenuClick}
        />
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
          <span style={{ marginRight: 16 }}>欢迎，{user?.username}</span>
          <a onClick={handleLogout}><LogoutOutlined /> 退出</a>
        </Header>
        <Content style={{ margin: 24, padding: 24, background: '#fff', minHeight: 280 }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/purchase/suppliers" element={<SupplierList />} />
            <Route path="/purchase/orders" element={<PurchaseOrderList />} />
            <Route path="/purchase/orders/new" element={<PurchaseOrderForm />} />
            <Route path="/sales/customers" element={<CustomerList />} />
            <Route path="/sales/orders" element={<Navigate to="/sales/in-stock-orders" replace />} />
            <Route path="/sales/orders/new" element={<Navigate to="/sales/in-stock-orders/new" replace />} />
            <Route path="/sales/in-stock-orders" element={<SalesOrderList orderType="in_stock" />} />
            <Route path="/sales/in-stock-orders/new" element={<SalesOrderForm orderType="in_stock" />} />
            <Route path="/sales/pre-orders" element={<SalesOrderList orderType="pre_order" />} />
            <Route path="/sales/pre-orders/new" element={<SalesOrderForm orderType="pre_order" />} />
            <Route path="/inventory/products" element={<ProductList />} />
            <Route path="/inventory/overview" element={<StockOverview />} />
            <Route path="/inventory/alerts" element={<StockAlert />} />
            <Route path="/settings/users" element={<UserManagement />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/*" element={
        <PrivateRoute><AppLayout /></PrivateRoute>
      } />
    </Routes>
  );
}
