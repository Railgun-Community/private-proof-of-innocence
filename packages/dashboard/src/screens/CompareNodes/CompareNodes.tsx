import { Table } from '@components/Table/Table';
import { Text } from '@components/Text/Text';
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
      key: 'Example index',
    },
  ];

  return (
    <div className={styles.compareNodesContainer}>
      <Text className={styles.compareNodesTitle}>Compare Nodes</Text>
      <Table data={data} columns={columns} title="TxID Merkletree" />
    </div>
  );
};
