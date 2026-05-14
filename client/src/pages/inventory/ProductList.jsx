import { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, Select, message, Space, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons';
import api from '../../api';

export default function ProductList() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState('');
  const [form] = Form.useForm();

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const params = {};
      if (keyword) params.keyword = keyword;
      if (category) params.category = category;
      const res = await api.get('/products', { params });
      setProducts(res.data);
    } catch (err) {
      message.error('获取商品列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProducts(); }, []);

  const categories = [...new Set(products.map(p => p.category).filter(Boolean))];

  const handleAdd = () => {
    setEditingProduct(null);
    form.resetFields();
    setModalOpen(true);
  };

  const handleEdit = (record) => {
    setEditingProduct(record);
    form.setFieldsValue(record);
    setModalOpen(true);
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/products/${id}`);
      message.success('删除成功');
      fetchProducts();
    } catch (err) {
      message.error(err.response?.data?.error || '删除失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editingProduct) {
        await api.put(`/products/${editingProduct.id}`, values);
        message.success('更新成功');
      } else {
        await api.post('/products', values);
        message.success('创建成功');
      }
      setModalOpen(false);
      fetchProducts();
    } catch (err) {
      if (err.response) message.error(err.response?.data?.error || '操作失败');
    }
  };

  const columns = [
    { title: '编码', dataIndex: 'sku', key: 'sku' },
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '分类', dataIndex: 'category', key: 'category' },
    { title: '单位', dataIndex: 'unit', key: 'unit' },
    { title: '进价', dataIndex: 'purchase_price', key: 'purchase_price', render: v => `¥${v?.toFixed(2)}` },
    { title: '售价', dataIndex: 'sale_price', key: 'sale_price', render: v => `¥${v?.toFixed(2)}` },
    {
      title: '库存', dataIndex: 'stock_quantity', key: 'stock_quantity',
      render: (v, record) => {
        const isLow = record.min_stock > 0 && v <= record.min_stock;
        return <span style={{ color: isLow ? 'red' : 'inherit', fontWeight: isLow ? 'bold' : 'normal' }}>{v}</span>;
      }
    },
    { title: '最低库存', dataIndex: 'min_stock', key: 'min_stock' },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at' },
    {
      title: '操作', key: 'action',
      render: (_, record) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Space>
          <Input placeholder="搜索商品" value={keyword} onChange={e => setKeyword(e.target.value)}
            onPressEnter={fetchProducts} style={{ width: 200 }} />
          <Select placeholder="分类筛选" value={category || undefined} onChange={v => setCategory(v || '')}
            allowClear style={{ width: 120 }}>
            {categories.map(c => (
              <Select.Option key={c} value={c}>{c}</Select.Option>
            ))}
          </Select>
          <Button icon={<SearchOutlined />} onClick={fetchProducts}>搜索</Button>
        </Space>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新增商品</Button>
      </div>

      <Table columns={columns} dataSource={products} rowKey="id" loading={loading} />

      <Modal title={editingProduct ? '编辑商品' : '新增商品'} open={modalOpen}
        onOk={handleSubmit} onCancel={() => setModalOpen(false)} okText="确定" cancelText="取消">
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="sku" label="编码" rules={[{ required: true, message: '请输入编码' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="category" label="分类">
            <Input placeholder="如：电子产品、食品、办公用品" />
          </Form.Item>
          <Form.Item name="unit" label="单位" initialValue="个">
            <Input placeholder="如：个、箱、kg" />
          </Form.Item>
          <Form.Item name="purchase_price" label="进价" initialValue={0}>
            <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="sale_price" label="售价" initialValue={0}>
            <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="min_stock" label="最低库存预警" initialValue={0}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
