import { isDefined } from '@railgun-community/shared-models';
import { useEffect, useMemo } from 'react';
import { FullScreenSpinner } from '@components/FullScreenSpinner/FullScreenSpinner';
import { useNodeStore } from '@state/stores';
import { List } from './components/List/List';
import { OverallStatus } from './components/OverallStatus/OverallStatus';
import styles from './NodeStatus.module.scss';

export const NodeStatus = () => {
  const {
    getNodeStatusForAllNetworks,
    nodeStatusForAllNetworks,
    loadingNodeStatusForAllNetworks,
    currentNetwork,
  } = useNodeStore();

  const nodeStatusForCurrentNetwork = useMemo(
    () => nodeStatusForAllNetworks?.forNetwork[currentNetwork],
    [currentNetwork, nodeStatusForAllNetworks?.forNetwork],
  );
  const listKeys = useMemo(
    () => nodeStatusForAllNetworks?.listKeys,
    [nodeStatusForAllNetworks],
  );

  useEffect(() => {
    if (!isDefined(nodeStatusForAllNetworks)) {
      getNodeStatusForAllNetworks();
    }
  }, [getNodeStatusForAllNetworks, nodeStatusForAllNetworks]);

  const renderListKey = (listKey: string, index: number) => (
    <List key={index} listKey={listKey} />
  );

  if (loadingNodeStatusForAllNetworks) {
    return <FullScreenSpinner />;
  }

  return (
    <div className={styles.nodeStatusContainer}>
      <OverallStatus nodeStatus={nodeStatusForCurrentNetwork} />
      {isDefined(listKeys) && listKeys.map(renderListKey)}
    </div>
  );
};
