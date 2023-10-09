import { isDefined } from '@railgun-community/shared-models';
import { useEffect, useMemo, useState } from 'react';
import { Table } from '@components/Table/Table';
import { Text } from '@components/Text/Text';
import { availableNodesArrayWithKeys } from '@constants/nodes';
import { useNodeStore } from '@state/stores';
import {
  ListStatuses,
  serializeAllNodesData,
  ShieldQueueStatus,
  TxIdStatus,
} from '@utils/nodes';
import styles from './CompareNodes.module.scss';

type MattSerializedDataEntry = [
  string,
  TxIdStatus | ShieldQueueStatus | ListStatuses,
][];

export const CompareNodes = () => {
  const { getAllNodesData, allNodesData } = useNodeStore();
  const [serializedData, setSerializedData] =
    useState<MattSerializedDataEntry>();
  const columns = availableNodesArrayWithKeys.map(node => node.key);

  useEffect(() => {
    if (!allNodesData) {
      getAllNodesData();
    }

    if (allNodesData) {
      const serializedData = serializeAllNodesData(allNodesData);
      setSerializedData(serializedData);
    }
  }, [allNodesData, getAllNodesData]);

  const txIdStatusData = useMemo(
    () => (isDefined(serializedData) ? serializedData?.[0] : []),
    [serializedData],
  );

  const shieldQueueStatusData = useMemo(
    () => (isDefined(serializedData) ? serializedData?.[1] : []),
    [serializedData],
  );

  const listStatusesData = useMemo(
    () => (isDefined(serializedData) ? serializedData?.[2] : []),
    [serializedData],
  );

  return (
    <div className={styles.compareNodesContainer}>
      <Text className={styles.compareNodesTitle}>Compare Nodes</Text>
      <Table data={txIdStatusData} columns={columns} />
      <Table data={shieldQueueStatusData} columns={columns} />
      <Table data={listStatusesData} columns={columns} />
    </div>
  );
};
