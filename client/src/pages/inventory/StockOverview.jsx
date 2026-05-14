import { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Table, Select, Tag } from 'antd';
import { InboxOutlined, AppstoreOutlined, DollarOutlined, AlertOutlined } from '@ant-design/icons';
import api from '../../api';

export default function StockOverview() {
  const [overview, setOverview] = useState(null);
  const [movements, setMovements] = useState([]);
  const [products, setProducts] = useState([]);
  const [filterProduct, setFilterProduct] = useState('');
  const [filterType, setFilterType] = useState('');

  useEffect(() => {
    api.get('/inventory/overview').then(res => setOverview(res.data));
    api.get('/products').then(res => setProducts(res.data));
    fetchMovements();
  }, []);

  const fetchMovements = async (productId = '', type = '') => {
    const params = {};
    if (productId) params.product_id = productId;
    if (type) params.type = type;
    const res = await api.get('/inventory/movements', { params });
    setMovements(res.data);
  };

  const handleFilter = (productId, type) => {
    setFilterProduct(productId);
    setFilterType(type);
    fetchMovements(productId, type);
  };

  const typeMap = {
    purchase_in: { text: '采购入库', color: 'green' },
    sales_out: { text: '销售出库', color: 'blue' },
    return_in: { text: '销售退货入库', color: 'orange' },
    return_out: { text: '采购退货出库', color: 'red' }
  };

  const movementColumns = [
    { title: '商品编码', dataIndex: 'product_sku', key: 'product_sku' },
    { title: '商品名称', dataIndex: 'product_name', key: 'product_name' },
    { title: '变动类型', dataIndex: 'type', key: 'type', render: v => <Tag color={typeMap[v]?.color}>{typeMap[v]?.text}</Tag> },
    { title: '数量', dataIndex: 'quantity', key: 'quantity' },
    { title: '操作员', dataIndex: 'operator_name', key: 'operator_name' },
    { title: '时间', dataIndex: 'created_at', key: 'created_at' },
  ];

  if (!overview) return null;

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card><Statistic title="商品种类" value={overview.totalProducts} prefix={<AppstoreOutlined />} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="库存总量" value={overview.totalStock} prefix={<InboxOutlined />} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="库存总值(进价)" value={overview.totalValue} prefix="¥" precision={2} /></Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="库存预警" value={overview.alertCount} prefix={<AlertOutlined />}
              valueStyle={{ color: overview.alertCount > 0 ? '#cf1322' : '#52c41a' }} />
          </Card>
        </Col>
      </Row>

      <Card title="库存变动记录">
        <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
          <Select placeholder="按商品筛选" value={filterProduct || undefined}
            onChange={v => handleFilter(v || '', filterType)}
            allowClear style={{ width: 200 }} showSearch optionFilterProp="label">
            {products.map(p => (
              <Select.Option key={p.id} value={p.id} label={`${p.sku} - ${p.name}`}>
                {p.sku} - {p.name}
              </Select.Option>
            ))}
          </Select>
          <Select placeholder="按类型筛选" value={filterType || undefined}
            onChange={v => handleFilter(filterProduct, v || '')}
            allowClear style={{ width: 150 }}>
            <Select.Option value="purchase_in">采购入库</Select.Option>
            <Select.Option value="sales_out">销售出库</Select.Option>
            <Select.Option value="return_in">销售退货入库</Select.Option>
            <Select.Option value="return_out">采购退货出库</Select.Option>
          </Select>
        </div>
        <Table columns={movementColumns} dataSource={movements} rowKey="id" size="small" />
      </Card>
    </div>
  );
}
