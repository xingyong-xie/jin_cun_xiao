import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Button, Tag, Space, Select, Input, message, Popconfirm, Modal } from 'antd';
import { PlusOutlined, SearchOutlined, PrinterOutlined } from '@ant-design/icons';
import api from '../../api';

const statusMap = {
  pending: { text: '待出库', color: 'orange' },
  confirmed: { text: '已出库', color: 'green' },
  returned: { text: '已退货', color: 'red' }
};

export default function SalesOrderList({ orderType = 'in_stock' }) {
  const isPreOrder = orderType === 'pre_order';
  const pageTitle = isPreOrder ? '订货单' : '现货单';
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [keyword, setKeyword] = useState('');
  const [detailOrder, setDetailOrder] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [printOrder, setPrintOrder] = useState(null);
  const [printOpen, setPrintOpen] = useState(false);
  const navigate = useNavigate();

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params = { order_type: orderType };
      if (status) params.status = status;
      if (keyword) params.keyword = keyword;
      const res = await api.get('/sales-orders', { params });
      setOrders(res.data);
    } catch (err) {
      message.error(`获取${pageTitle}列表失败`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOrders(); }, [orderType]);

  const handleConfirm = async (id) => {
    try {
      await api.put(`/sales-orders/${id}/confirm`);
      message.success('出库确认成功');
      fetchOrders();
    } catch (err) {
      message.error(err.response?.data?.error || '操作失败');
    }
  };

  const handleReturn = async (id) => {
    try {
      await api.put(`/sales-orders/${id}/return`);
      message.success('退货成功');
      fetchOrders();
    } catch (err) {
      message.error(err.response?.data?.error || '操作失败');
    }
  };

  const showDetail = async (id) => {
    try {
      const res = await api.get(`/sales-orders/${id}`);
      setDetailOrder(res.data);
      setDetailOpen(true);
    } catch (err) {
      message.error('获取详情失败');
    }
  };

  const showPrint = async (id) => {
    try {
      const res = await api.get(`/sales-orders/${id}`);
      const order = res.data;
      const inStockItems = (order.items || []).filter(it => (it.delivery_type || 'in_stock') === 'in_stock');
      if (inStockItems.length === 0) {
        return message.warning('该单据无现货明细，无需开单');
      }
      setPrintOrder({ ...order, items: inStockItems });
      setPrintOpen(true);
    } catch (err) {
      message.error('获取详情失败');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const hasInStockItems = (record) =>
    (record.items || []).some(it => (it.delivery_type || 'in_stock') === 'in_stock');

  const itemColumns = [
    { title: '商品编码', dataIndex: 'product_sku', key: 'product_sku' },
    { title: '商品名称', dataIndex: 'product_name', key: 'product_name' },
    { title: '单位', dataIndex: 'product_unit', key: 'product_unit' },
    {
      title: '类型', dataIndex: 'delivery_type', key: 'delivery_type',
      render: v => v === 'pre_order'
        ? <Tag color="blue">订货</Tag>
        : <Tag color="cyan">现货</Tag>
    },
    { title: '数量', dataIndex: 'quantity', key: 'quantity' },
    { title: '单价', dataIndex: 'unit_price', key: 'unit_price', render: v => `¥${v?.toFixed(2)}` },
    { title: '小计', dataIndex: 'amount', key: 'amount', render: v => `¥${v?.toFixed(2)}` },
  ];

  const columns = [
    { title: '单号', dataIndex: 'order_no', key: 'order_no', render: (v, r) => <a onClick={() => showDetail(r.id)}>{v}</a> },
    { title: '客户', dataIndex: 'customer_name', key: 'customer_name' },
    { title: '总金额', dataIndex: 'total_amount', key: 'total_amount', render: v => `¥${v?.toFixed(2)}` },
    { title: '状态', dataIndex: 'status', key: 'status', render: v => <Tag color={statusMap[v]?.color}>{statusMap[v]?.text}</Tag> },
    { title: '操作员', dataIndex: 'operator_name', key: 'operator_name' },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at' },
    {
      title: '操作', key: 'action',
      render: (_, record) => (
        <Space>
          {!isPreOrder && hasInStockItems(record) && (
            <Button type="link" size="small" icon={<PrinterOutlined />} onClick={() => showPrint(record.id)}>
              打印开单
            </Button>
          )}
          {record.status === 'pending' && (
            <Popconfirm title="确认出库？" onConfirm={() => handleConfirm(record.id)}>
              <Button type="link" size="small">确认出库</Button>
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
            <Select.Option value="pending">待出库</Select.Option>
            <Select.Option value="confirmed">已出库</Select.Option>
            <Select.Option value="returned">已退货</Select.Option>
          </Select>
          <Input placeholder="搜索单号/客户" value={keyword} onChange={e => setKeyword(e.target.value)}
            onPressEnter={fetchOrders} style={{ width: 200 }} />
          <Button icon={<SearchOutlined />} onClick={fetchOrders}>搜索</Button>
        </Space>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate(isPreOrder ? '/sales/pre-orders/new' : '/sales/in-stock-orders/new')}>
          新增{pageTitle}
        </Button>
      </div>

      <Table columns={columns} dataSource={orders} rowKey="id" loading={loading}
        expandable={{ expandedRowRender: record => (
          <Table columns={itemColumns} dataSource={record.items} rowKey="id" pagination={false} size="small" />
        )}} />

      <Modal title={`${pageTitle}详情`} open={detailOpen} onCancel={() => setDetailOpen(false)} footer={null} width={700}>
        {detailOrder && (
          <div>
            <p><strong>单号：</strong>{detailOrder.order_no}</p>
            <p><strong>客户：</strong>{detailOrder.customer_name}</p>
            <p><strong>状态：</strong><Tag color={statusMap[detailOrder.status]?.color}>{statusMap[detailOrder.status]?.text}</Tag></p>
            <p><strong>总金额：</strong>¥{detailOrder.total_amount?.toFixed(2)}</p>
            <Table columns={itemColumns} dataSource={detailOrder.items} rowKey="id" pagination={false} size="small" />
          </div>
        )}
      </Modal>

      <Modal
        title="销售开单（现货）"
        open={printOpen}
        onCancel={() => setPrintOpen(false)}
        width={780}
        footer={[
          <Button key="cancel" onClick={() => setPrintOpen(false)}>关闭</Button>,
          <Button key="print" type="primary" icon={<PrinterOutlined />} onClick={handlePrint}>打印</Button>
        ]}
      >
        {printOrder && (
          <div id="print-area" className="sales-invoice">
            <h2 style={{ textAlign: 'center', margin: '0 0 12px' }}>销 售 开 单</h2>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span><strong>单号：</strong>{printOrder.order_no}</span>
              <span><strong>日期：</strong>{printOrder.created_at}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <span><strong>客户：</strong>{printOrder.customer_name}</span>
              <span><strong>联系电话：</strong>{printOrder.customer_phone || '—'}</span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f5f5f5' }}>
                  <th style={cellStyle}>序号</th>
                  <th style={cellStyle}>商品编码</th>
                  <th style={cellStyle}>商品名称</th>
                  <th style={cellStyle}>单位</th>
                  <th style={cellStyle}>数量</th>
                  <th style={cellStyle}>单价</th>
                  <th style={cellStyle}>金额</th>
                </tr>
              </thead>
              <tbody>
                {printOrder.items.map((it, idx) => (
                  <tr key={it.id}>
                    <td style={cellStyle}>{idx + 1}</td>
                    <td style={cellStyle}>{it.product_sku}</td>
                    <td style={cellStyle}>{it.product_name}</td>
                    <td style={cellStyle}>{it.product_unit}</td>
                    <td style={cellStyle}>{it.quantity}</td>
                    <td style={cellStyle}>¥{Number(it.unit_price).toFixed(2)}</td>
                    <td style={cellStyle}>¥{Number(it.amount).toFixed(2)}</td>
                  </tr>
                ))}
                <tr>
                  <td style={cellStyle} colSpan={6}><strong>合计</strong></td>
                  <td style={cellStyle}>
                    <strong>¥{printOrder.items.reduce((s, it) => s + Number(it.amount || 0), 0).toFixed(2)}</strong>
                  </td>
                </tr>
              </tbody>
            </table>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 32, fontSize: 13 }}>
              <span>制单人：{printOrder.operator_name}</span>
              <span>客户签收：__________________</span>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

const cellStyle = {
  border: '1px solid #999',
  padding: '6px 8px',
  textAlign: 'center'
};
