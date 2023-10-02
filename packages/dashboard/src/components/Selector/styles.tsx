import colors from '@scss/colors.module.scss';
import typography from '@scss/typography.module.scss';

export const styles = {
  control: {
    backgroundColor: colors.lightGray,
    color: colors.black,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    alignContent: 'center',
    borderRadius: 4,
    boxShadow: 'none',
    height: '100%',
    boxSizing: 'border-box' as 'border-box',
    border: `1px solid transparent`,
  },
  focusedControl: {
    border: `1px solid ${colors.darkGray}`,
    boxShadow: `0px 0px 10px 0px rgba(0, 0, 0, 0.1)`,
  },
  indicatorSeparator: {
    color: 'transparent',
  },
  inputText: {
    color: colors.black,
    fontFamily: typography.fontFamily,
    paddingLeft: 7,
    cursor: 'default',
  },
  menu: {
    borderRadius: 4,
    padding: 0,
    border: `1px solid ${colors.darkGray}`,
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
    color: colors.black,
    backgroundColor: colors.darkGray,
  },
  selectedOption: {
    backgroundColor: colors.white,
    color: colors.black,
    fontWeight: 600,
  },
  focusedOption: {
    backgroundColor: colors.gray,
  },
};
