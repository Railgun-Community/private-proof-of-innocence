import { isDefined } from '@railgun-community/shared-models';
import { useEffect, useState } from 'react';
import { Header } from '@components/Header/Header';
import { Text } from '@components/Text/Text';
import { NodeStatusAllNetworks } from '@models/api-types';
import { POINodeRequest } from '@services/poi-node-request';

export const Landing = () => {
  const [data, setData] = useState<NodeStatusAllNetworks>();

  useEffect(() => {
    const getAndSetData = async () => {
      const data = await POINodeRequest.getNodeStatusAllNetworks(
        'localhost:3010',
      );
      setData(data);
    };
    if (!isDefined(data)) {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      getAndSetData();
    }
  }, [data]);

  return (
    <div>
      <Header />
      <Text>Hello World, I'm Landing!</Text>
      {data &&
        data.listKeys.map((key: string) => {
          return <Text style={{ color: 'green' }}>{key}</Text>;
        })}
    </div>
  );
};
