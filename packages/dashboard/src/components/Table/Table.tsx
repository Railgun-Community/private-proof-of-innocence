import { isDefined } from '@railgun-community/shared-models';
import cn from 'classnames';
import { Spinner } from '@components/Spinner/Spinner';
import { Text } from '@components/Text/Text';
import styles from './Table.module.scss';

type Props = {
  data: any[];
  columns: any[];
};

// TODO: Fix this component when you have all the data, lots of improvements to be made
export const Table = ({ data, columns }: Props) => {
  const [key, dataToDisplay] = data;
  const dataArray = Object.entries(dataToDisplay ?? []);

  const renderValueWithLoading =
    (isOdd: boolean) => (value: string | number, index: number) => {
      return (
        <td
          key={index}
          className={cn(styles.tableKeyCell, {
            [styles.tableCellOdd]: isOdd,
          })}
        >
          {!isDefined(value) ? <Spinner size={20} /> : <>{`${value}`}</>}
        </td>
      );
    };

  return (
    <>
      <Text style={{ color: 'black', width: '100%', paddingLeft: 5 }}>
        {key}
      </Text>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.tableHeader} />
            {columns.map(column => (
              <th className={styles.tableHeader} key={column}>
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dataArray.map((item: any, index) => {
            const isOdd = index % 2 === 0;
            const keyName = item[0];
            const values = item[1];

            return (
              <tr key={index}>
                <td
                  className={cn(styles.tableKeyCell, {
                    [styles.tableCellOdd]: isOdd,
                  })}
                >
                  {keyName}
                </td>
                {values.map(renderValueWithLoading(isOdd))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
};
