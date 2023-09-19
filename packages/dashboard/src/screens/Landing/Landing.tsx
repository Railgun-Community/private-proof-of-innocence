import {
  isDefined,
  NodeStatusAllNetworks,
} from '@railgun-community/shared-models';
import { useEffect, useMemo, useState } from 'react';
import { POINodeRequest } from '@services/poi-node-request';
import { List } from './components/List/List';
import { OverallStatus } from './components/OverallStatus/OverallStatus';
import styles from './Landing.module.scss';

const currentNetwork = 'Ethereum_Goerli'; //TODO: Change this.

//TODO: Rename this for the correct name
export const Landing = () => {
  const [nodeStatusAllNetworks, setNodeStatusAllNetworks] =
    useState<NodeStatusAllNetworks>();

  const nodeStatusForCurrentNetwork = useMemo(
    () => nodeStatusAllNetworks?.forNetwork[currentNetwork],
    [nodeStatusAllNetworks],
  );
  const listKeys = useMemo(
    () => nodeStatusAllNetworks?.listKeys,
    [nodeStatusAllNetworks],
  );

  useEffect(() => {
    const getAndSetNodeStatusData = async () => {
      const data = await POINodeRequest.getNodeStatusAllNetworks(
        'http://localhost:3010',
      );
      setNodeStatusAllNetworks(data);
      console.log('DATA:', data);
    };
    if (!isDefined(nodeStatusAllNetworks)) {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      getAndSetNodeStatusData();
    }
  }, [nodeStatusAllNetworks]);

  const renderListKey = (listKey: string) => <List listKey={listKey} />;

  return (
    <>
      <div className={styles.landingContainer}>
        <OverallStatus nodeStatus={nodeStatusForCurrentNetwork} />
        {isDefined(listKeys) && listKeys.map(renderListKey)}
      </div>
    </>
  );
};
