import { isDefined } from '@railgun-community/shared-models';
import cn from 'classnames';
import { Spinner } from '@components/Spinner/Spinner';
import { Text } from '@components/Text/Text';
import styles from './Table.module.scss';

type Props = {
  data: any[];
  columns: any[];
  title: string;
};

// TODO: Fix this component when you have all the data, lots of improvements to be made
export const Table = ({ data, columns, title }: Props) => {
  return (
    <>
      <Text style={{ color: 'black', width: '100%', paddingLeft: 5 }}>
        {title}
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
          {data.map((item, index) => {
            const isOdd = index % 2 === 0;

            return (
              <tr key={item.key}>
                <td
                  className={cn(styles.tableKeyCell, {
                    [styles.tableCellOdd]: isOdd,
                  })}
                >
                  {item.key}
                </td>
                <td
                  className={cn(styles.tableCell, {
                    [styles.tableCellOdd]: isOdd,
                  })}
                >
                  {!isDefined(item.nodeName1) ? (
                    <Spinner size={15} />
                  ) : (
                    item.nodeName1
                  )}
                </td>
                <td
                  className={cn(styles.tableCell, {
                    [styles.tableCellOdd]: isOdd,
                  })}
                >
                  {!isDefined(item.nodeName2) ? (
                    <Spinner size={15} />
                  ) : (
                    item.nodeName2
                  )}
                </td>
                <td
                  className={cn(styles.tableCell, {
                    [styles.tableCellOdd]: isOdd,
                  })}
                >
                  {!isDefined(item.nodeName3) ? (
                    <Spinner size={15} />
                  ) : (
                    item.nodeName3
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
};
