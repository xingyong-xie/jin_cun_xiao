import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Button, Tag, Space, Select, Input, DatePicker, message, Popconfirm, Modal } from 'antd';
import { PlusOutlined, SearchOutlined } from '@ant-design/icons';
import api from '../../api';

const { RangePicker } = DatePicker;

const statusMap = {
  pending: { text: '待入库', color: 'orange' },
  confirmed: { text: '已入库', color: 'green' },
  returned: { text: '已退货', color: 'red' }
};

export default function PurchaseOrderList() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [keyword, setKeyword] = useState('');
  const [detailOrder, setDetailOrder] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const navigate = useNavigate();

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params = {};
      if (status) params.status = status;
      if (keyword) params.keyword = keyword;
      const res = await api.get('/purchase-orders', { params });
      setOrders(res.data);
    } catch (err) {
      message.error('获取进货单列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOrders(); }, []);

  const handleConfirm = async (id) => {
    try {
      await api.put(`/purchase-orders/${id}/confirm`);
      message.success('入库确认成功');
      fetchOrders();
    } catch (err) {
      message.error(err.response?.data?.error || '操作失败');
    }
  };

  const handleReturn = async (id) => {
    try {
      await api.put(`/purchase-orders/${id}/return`);
      message.success('退货成功');
      fetchOrders();
    } catch (err) {
      message.error(err.response?.data?.error || '操作失败');
    }
  };

  const showDetail = async (id) => {
    try {
      const res = await api.get(`/purchase-orders/${id}`);
      setDetailOrder(res.data);
      setDetailOpen(true);
    } catch (err) {
      message.error('获取详情失败');
    }
  };

  const itemColumns = [
    { title: '商品编码', dataIndex: 'product_sku', key: 'product_sku' },
    { title: '商品名称', dataIndex: 'product_name', key: 'product_name' },
    { title: '单位', dataIndex: 'product_unit', key: 'product_unit' },
    { title: '数量', dataIndex: 'quantity', key: 'quantity' },
    { title: '单价', dataIndex: 'unit_price', key: 'unit_price', render: v => `¥${v?.toFixed(2)}` },
    { title: '小计', dataIndex: 'amount', key: 'amount', render: v => `¥${v?.toFixed(2)}` },
  ];

  const columns = [
    { title: '单号', dataIndex: 'order_no', key: 'order_no', render: (v, r) => <a onClick={() => showDetail(r.id)}>{v}</a> },
    { title: '供应商', dataIndex: 'supplier_name', key: 'supplier_name' },
    { title: '总金额', dataIndex: 'total_amount', key: 'total_amount', render: v => `¥${v?.toFixed(2)}` },
    { title: '状态', dataIndex: 'status', key: 'status', render: v => <Tag color={statusMap[v]?.color}>{statusMap[v]?.text}</Tag> },
    { title: '操作员', dataIndex: 'operator_name', key: 'operator_name' },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at' },
    {
      title: '操作', key: 'action',
      render: (_, record) => (
        <Space>
          {record.status === 'pending' && (
            <Popconfirm title="确认入库？" onConfirm={() => handleConfirm(record.id)}>
              <Button type="link" size="small">确认入库</Button>
            </Popconfirm>
          )}
          {record.status === 'confirmed' && (
            <Popconfirm title="确认退货？" onConfirm={() => handleReturn(record.id)}>
              <Button type="link" danger size="small">退货</Button>
            </Popconfirm>
          )}
        </Space>
      )
    }
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Space>
          <Select placeholder="状态筛选" value={status || undefined} onChange={v => setStatus(v || '')}
            allowClear style={{ width: 120 }}>
            <Select.Option value="pending">待入库</Select.Option>
            <Select.Option value="confirmed">已入库</Select.Option>
            <Select.Option value="returned">已退货</Select.Option>
          </Select>
          <Input placeholder="搜索单号/供应商" value={keyword} onChange={e => setKeyword(e.target.value)}
            onPressEnter={fetchOrders} style={{ width: 200 }} />
          <Button icon={<SearchOutlined />} onClick={fetchOrders}>搜索</Button>
        </Space>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/purchase/orders/new')}>
          新增进货单
        </Button>
      </div>

      <Table columns={columns} dataSource={orders} rowKey="id" loading={loading}
        expandable={{ expandedRowRender: record => (
          <Table columns={itemColumns} dataSource={record.items} rowKey="id" pagination={false} size="small" />
        )}} />

      <Modal title="进货单详情" open={detailOpen} onCancel={() => setDetailOpen(false)} footer={null} width={700}>
        {detailOrder && (
          <div>
            <p><strong>单号：</strong>{detailOrder.order_no}</p>
            <p><strong>供应商：</strong>{detailOrder.supplier_name}</p>
            <p><strong>状态：</strong><Tag color={statusMap[detailOrder.status]?.color}>{statusMap[detailOrder.status]?.text}</Tag></p>
            <p><strong>总金额：</strong>¥{detailOrder.total_amount?.toFixed(2)}</p>
            <Table columns={itemColumns} dataSource={detailOrder.items} rowKey="id" pagination={false} size="small" />
          </div>
        )}
      </Modal>
    </div>
  );
}
