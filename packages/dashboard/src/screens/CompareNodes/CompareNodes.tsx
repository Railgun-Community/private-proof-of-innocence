import { Table } from '@components/Table/Table';
import styles from './CompareNodes.module.scss';

export const CompareNodes = () => {
  const columns = ['nodeName1', 'nodeName3', 'nodeName3'];
  const data = [
    {
      key: 'Cannot index',
      nodeName1: 47,
      nodeName2: 47,
      nodeName3: 36,
    },
    {
      key: 'Validated index',
      nodeName1: 47,
      nodeName2: 45,
      nodeName3: 36,
    },
    {
      key: 'Ajam index',
    },
  ];

  return (
    <div className={styles.compareNodesContainer}>
      <h1 style={{ color: 'black' }}>Compare Nodes</h1>
      <Table data={data} columns={columns} title="TxID Merkletree" />
    </div>
  );
};
