import colors from '@scss/colors.module.scss';
import typography from '@scss/typography.module.scss';

export const styles = {
  control: {
    backgroundColor: colors.black,
    border: `1px solid ${colors.lightBlack}`,
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    alignContent: 'center',
    borderRadius: 4,
    boxShadow: 'none',
    height: '100%',
    boxSizing: 'border-box' as 'border-box',
  },
  focusedControl: {
    border: `1px solid ${colors.coldGray}`,
    backgroundColor: colors.lightGray,
    boxShadow: 'none',
  },
  indicatorSeparator: {
    color: 'transparent',
  },
  inputText: {
    color: colors.white,
    fontFamily: typography.fontFamily,
    paddingLeft: 7,
    cursor: 'default',
  },
  menu: {
    borderRadius: 4,
    padding: 0,
    border: `1px solid ${colors.lightBlack}`,
  },
  menuList: {
    padding: 0,
    fontFamily: typography.fontFamily,
  },
  valueContainer: {
    display: 'flex',
    flexWrap: 'nowrap' as 'nowrap',
    justifyContent: 'flex-start',
  },
  option: {
    cursor: 'pointer',
    padding: '8px 15px',
    fontFamily: typography.fontFamily,
    color: colors.white,
    backgroundColor: colors.coldGray,
  },
  selectedOption: {
    backgroundColor: colors.lightGray,
  },
  focusedOption: {
    backgroundColor: colors.black,
  },
};
