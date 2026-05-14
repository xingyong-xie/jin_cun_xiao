import { useState, useEffect } from 'react';
import { Table, Card, Tag } from 'antd';
import { AlertOutlined } from '@ant-design/icons';
import api from '../../api';

export default function StockAlert() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get('/inventory/alerts').then(res => {
      setAlerts(res.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const columns = [
    { title: '编码', dataIndex: 'sku', key: 'sku' },
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '分类', dataIndex: 'category', key: 'category' },
    { title: '单位', dataIndex: 'unit', key: 'unit' },
    { title: '当前库存', dataIndex: 'stock_quantity', key: 'stock_quantity',
      render: v => <span style={{ color: 'red', fontWeight: 'bold' }}>{v}</span>
    },
    { title: '最低库存', dataIndex: 'min_stock', key: 'min_stock' },
    { title: '缺口', key: 'gap',
      render: (_, record) => <Tag color="red">{record.min_stock - record.stock_quantity}</Tag>
    },
  ];

  return (
    <Card title={<span><AlertOutlined style={{ color: '#faad14', marginRight: 8 }} />库存预警列表</span>}>
      <Table columns={columns} dataSource={alerts} rowKey="id" loading={loading}
        locale={{ emptyText: '暂无库存预警，所有商品库存充足' }} />
    </Card>
  );
}
