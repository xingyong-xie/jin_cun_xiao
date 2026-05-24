import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Select, Button, Table, InputNumber, message, Card, Space, Tag } from 'antd';
import { PlusOutlined, DeleteOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import api from '../../api';

export default function SalesOrderForm({ orderType = 'in_stock' }) {
  const isPreOrder = orderType === 'pre_order';
  const pageTitle = isPreOrder ? '订货单' : '现货单';
  const listPath = isPreOrder ? '/sales/pre-orders' : '/sales/in-stock-orders';
  const defaultDeliveryType = isPreOrder ? 'pre_order' : 'in_stock';

  const [form] = Form.useForm();
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [items, setItems] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/customers').then(res => setCustomers(res.data));
    api.get('/products').then(res => setProducts(res.data));
  }, []);

  const addItem = () => {
    setItems([...items, { key: Date.now(), product_id: null, quantity: 1, unit_price: 0, amount: 0, delivery_type: defaultDeliveryType }]);
  };

  const removeItem = (key) => {
    setItems(items.filter(item => item.key !== key));
  };

  const updateItem = (key, field, value) => {
    setItems(items.map(item => {
      if (item.key === key) {
        const updated = { ...item, [field]: value };
        if (field === 'product_id') {
          const product = products.find(p => p.id === value);
          if (product) {
            updated.unit_price = product.sale_price;
            updated.amount = product.sale_price * item.quantity;
          }
        }
        if (field === 'quantity' || field === 'unit_price') {
          updated.amount = (field === 'quantity' ? value : item.unit_price) * (field === 'unit_price' ? value : item.quantity);
        }
        return updated;
      }
      return item;
    }));
  };

  const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (items.length === 0) {
        return message.error('请添加商品');
      }
      const invalidItem = items.find(item => !item.product_id);
      if (invalidItem) {
        return message.error('请选择所有商品');
      }

      const res = await api.post('/sales-orders', {
        customer_id: values.customer_id,
        order_type: orderType,
        items: items.map(item => ({
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          delivery_type: item.delivery_type || defaultDeliveryType
        }))
      });

      const { primary, secondary } = res.data || {};
      const typeName = t => t === 'pre_order' ? '订货单' : '现货单';

      if (primary && secondary) {
        message.success(`${typeName(primary.type)} ${primary.order_no} 与 ${typeName(secondary.type)} ${secondary.order_no} 已创建`);
      } else if (primary) {
        message.success(`${typeName(primary.type)} ${primary.order_no} 创建成功`);
      } else if (secondary) {
        message.success(`明细全部为${typeName(secondary.type === 'pre_order' ? 'pre_order' : 'in_stock')}，已生成 ${typeName(secondary.type)} ${secondary.order_no}`);
      }

      // 决定跳转：有主单则跳主单列表，否则跳副单列表
      const targetType = primary ? primary.type : secondary?.type;
      const targetPath = targetType === 'pre_order' ? '/sales/pre-orders' : '/sales/in-stock-orders';
      navigate(targetPath);
    } catch (err) {
      if (err.response) message.error(err.response?.data?.error || '创建失败');
    }
  };

  const columns = [
    {
      title: '商品', dataIndex: 'product_id', key: 'product_id',
      render: (v, record) => (
        <Select value={v} onChange={val => updateItem(record.key, 'product_id', val)}
          style={{ width: '100%' }} placeholder="选择商品" showSearch optionFilterProp="label">
          {products.map(p => (
            <Select.Option key={p.id} value={p.id} label={`${p.sku} - ${p.name}`}>
              {p.sku} - {p.name} <Tag color={p.stock_quantity <= p.min_stock && p.min_stock > 0 ? 'red' : 'green'}>
                库存: {p.stock_quantity}{p.unit}
              </Tag>
            </Select.Option>
          ))}
        </Select>
      )
    },
    {
      title: '类型', dataIndex: 'delivery_type', key: 'delivery_type', width: 110,
      render: (v, record) => (
        <Select value={v || 'in_stock'} onChange={val => updateItem(record.key, 'delivery_type', val)}
          style={{ width: '100%' }}>
          <Select.Option value="in_stock">现货</Select.Option>
          <Select.Option value="pre_order">订货</Select.Option>
        </Select>
      )
    },
    {
      title: '数量', dataIndex: 'quantity', key: 'quantity', width: 100,
      render: (v, record) => {
        const product = products.find(p => p.id === record.product_id);
        const max = isPreOrder || (record.delivery_type === 'pre_order')
          ? 999999
          : (product?.stock_quantity || 999);
        return (
          <InputNumber min={1} max={max} value={v}
            onChange={val => updateItem(record.key, 'quantity', val)} style={{ width: '100%' }} />
        );
      }
    },
    {
      title: '单价', dataIndex: 'unit_price', key: 'unit_price', width: 120,
      render: (v, record) => (
        <InputNumber min={0} step={0.01} value={v} onChange={val => updateItem(record.key, 'unit_price', val)} style={{ width: '100%' }} />
      )
    },
    {
      title: '小计', dataIndex: 'amount', key: 'amount', width: 120,
      render: v => `¥${v.toFixed(2)}`
    },
    {
      title: '操作', key: 'action', width: 60,
      render: (_, record) => (
        <Button type="link" danger icon={<DeleteOutlined />} onClick={() => removeItem(record.key)} />
      )
    }
  ];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(listPath)}>返回列表</Button>
      </div>

      <Card title={`创建${pageTitle}`}>
        <Form form={form} layout="inline" style={{ marginBottom: 16 }}>
          <Form.Item name="customer_id" label="客户" rules={[{ required: true, message: '请选择客户' }]}>
            <Select style={{ width: 250 }} placeholder="选择客户" showSearch optionFilterProp="label">
              {customers.map(c => (
                <Select.Option key={c.id} value={c.id} label={c.name}>{c.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>

        <Button type="dashed" icon={<PlusOutlined />} onClick={addItem} style={{ width: '100%', marginBottom: 16 }}>
          添加商品
        </Button>

        <Table columns={columns} dataSource={items} rowKey="key" pagination={false} size="small" />

        <div style={{ marginTop: 16, textAlign: 'right', fontSize: 16 }}>
          <strong>合计：¥{totalAmount.toFixed(2)}</strong>
        </div>

        <div style={{ marginTop: 16, textAlign: 'right' }}>
          <Space>
            <Button onClick={() => navigate(listPath)}>取消</Button>
            <Button type="primary" onClick={handleSubmit}>提交</Button>
          </Space>
        </div>
      </Card>
    </div>
  );
}
