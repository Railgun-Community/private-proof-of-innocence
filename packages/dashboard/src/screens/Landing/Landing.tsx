import {
  isDefined,
  NodeStatusAllNetworks,
} from '@railgun-community/shared-models';
import { useEffect, useState } from 'react';
import { Text } from '@components/Text/Text';
import { POINodeRequest } from '@services/poi-node-request';
import { OverallStatus } from './components/OverallStatus/OverallStatus';
import styles from './Landing.module.scss';

export const Landing = () => {
  // const [data, setData] = useState<NodeStatusAllNetworks>();

<<<<<<< HEAD
  useEffect(() => {
    const getAndSetData = async () => {
      const data = await POINodeRequest.getNodeStatusAllNetworks(
        'http://localhost:3010',
      );
      setData(data);
      console.log('DATA:', data); // This line Jake
    };
    if (!isDefined(data)) {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      getAndSetData();
    }
  }, [data]);
=======
  // useEffect(() => {
  //   const getAndSetData = async () => {
  //     const data = await POINodeRequest.getNodeStatusAllNetworks(
  //       'localhost:3010',
  //     );
  //     setData(data);
  //   };
  //   if (!isDefined(data)) {
  //     // eslint-disable-next-line @typescript-eslint/no-floating-promises
  //     getAndSetData();
  //   }
  // }, [data]);
>>>>>>> 0eef1d5 (WIP)

  return (
    <>
      <div className={styles.landingContainer}>
        <OverallStatus />
        {/* {data &&
          data.listKeys.map((key: string) => {
            return <Text style={{ color: 'green' }}>{key}</Text>;
          })} */}
      </div>
    </>
  );
};
