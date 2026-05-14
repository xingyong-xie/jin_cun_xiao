import { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Table, Tag } from 'antd';
import {
  ShoppingCartOutlined, DollarOutlined,
  AlertOutlined, InboxOutlined
} from '@ant-design/icons';
import api from '../api';

const statusMap = {
  pending: { text: '待入库', color: 'orange' },
  confirmed: { text: '已入库', color: 'green' },
  returned: { text: '已退货', color: 'red' }
};
const salesStatusMap = {
  pending: { text: '待出库', color: 'orange' },
  confirmed: { text: '已出库', color: 'green' },
  returned: { text: '已退货', color: 'red' }
};

export default function Dashboard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get('/dashboard').then(res => setData(res.data));
  }, []);

  if (!data) return null;

  const purchaseColumns = [
    { title: '单号', dataIndex: 'order_no', key: 'order_no' },
    { title: '供应商', dataIndex: 'supplier_name', key: 'supplier_name' },
    { title: '金额', dataIndex: 'total_amount', key: 'total_amount', render: v => `¥${v?.toFixed(2)}` },
    { title: '状态', dataIndex: 'status', key: 'status', render: v => <Tag color={statusMap[v]?.color}>{statusMap[v]?.text}</Tag> },
    { title: '时间', dataIndex: 'created_at', key: 'created_at' }
  ];

  const salesColumns = [
    { title: '单号', dataIndex: 'order_no', key: 'order_no' },
    { title: '客户', dataIndex: 'customer_name', key: 'customer_name' },
    { title: '金额', dataIndex: 'total_amount', key: 'total_amount', render: v => `¥${v?.toFixed(2)}` },
    { title: '状态', dataIndex: 'status', key: 'status', render: v => <Tag color={salesStatusMap[v]?.color}>{salesStatusMap[v]?.text}</Tag> },
    { title: '时间', dataIndex: 'created_at', key: 'created_at' }
  ];

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card><Statistic title="今日采购额" value={data.todayPurchaseAmount} prefix="¥" precision={2} valueStyle={{ color: '#1890ff' }} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="今日销售额" value={data.todaySalesAmount} prefix="¥" precision={2} valueStyle={{ color: '#52c41a' }} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="累计采购额" value={data.totalPurchaseAmount} prefix="¥" precision={2} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="库存预警" value={data.alertCount} prefix={<AlertOutlined />} valueStyle={{ color: data.alertCount > 0 ? '#cf1322' : '#52c41a' }} /></Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={12}>
          <Card title="近期进货单" size="small">
            <Table columns={purchaseColumns} dataSource={data.recentPurchaseOrders} rowKey="id" pagination={false} size="small" />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="近期销货单" size="small">
            <Table columns={salesColumns} dataSource={data.recentSalesOrders} rowKey="id" pagination={false} size="small" />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
