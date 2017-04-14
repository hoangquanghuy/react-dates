import React from 'react';
import PropTypes from 'prop-types';
import momentPropTypes from 'react-moment-proptypes';
import { forbidExtraProps, nonNegativeInteger } from 'airbnb-prop-types';
import moment from 'moment';

import { DayPickerPhrases } from '../defaultPhrases';
import getPhrasePropTypes from '../utils/getPhrasePropTypes';

import isTouchDevice from '../utils/isTouchDevice';

import isInclusivelyAfterDay from '../utils/isInclusivelyAfterDay';
import isInclusivelyBeforeDay from '../utils/isInclusivelyBeforeDay';
import isNextDay from '../utils/isNextDay';
import isSameDay from '../utils/isSameDay';
import isAfterDay from '../utils/isAfterDay';
import isBeforeDay from '../utils/isBeforeDay';

import getVisibleDays from '../utils/getVisibleDays';
import isDayVisible from '../utils/isDayVisible';

import toISODateString from '../utils/toISODateString';

import FocusedInputShape from '../shapes/FocusedInputShape';
import ScrollableOrientationShape from '../shapes/ScrollableOrientationShape';

import {
  START_DATE,
  END_DATE,
  HORIZONTAL_ORIENTATION,
  DAY_SIZE,
} from '../../constants';

import DayPicker, { defaultProps as DayPickerDefaultProps } from './DayPicker';

const propTypes = forbidExtraProps({
  startDate: momentPropTypes.momentObj,
  endDate: momentPropTypes.momentObj,
  onDatesChange: PropTypes.func,

  focusedInput: FocusedInputShape,
  onFocusChange: PropTypes.func,
  onClose: PropTypes.func,

  keepOpenOnDateSelect: PropTypes.bool,
  minimumNights: PropTypes.number,
  isOutsideRange: PropTypes.func,
  isDayBlocked: PropTypes.func,
  isDayHighlighted: PropTypes.func,

  // DayPicker props
  enableOutsideDays: PropTypes.bool,
  numberOfMonths: PropTypes.number,
  orientation: ScrollableOrientationShape,
  withPortal: PropTypes.bool,
  initialVisibleMonth: PropTypes.func,
  daySize: nonNegativeInteger,

  navPrev: PropTypes.node,
  navNext: PropTypes.node,

  onPrevMonthClick: PropTypes.func,
  onNextMonthClick: PropTypes.func,
  onOutsideClick: PropTypes.func,
  renderDay: PropTypes.func,
  renderCalendarInfo: PropTypes.func,

  // accessibility
  onBlur: PropTypes.func,
  isFocused: PropTypes.bool,
  showKeyboardShortcuts: PropTypes.bool,

  // i18n
  monthFormat: PropTypes.string,
  phrases: PropTypes.shape(getPhrasePropTypes(DayPickerPhrases)),
});

const defaultProps = {
  startDate: undefined, // TODO: use null
  endDate: undefined, // TODO: use null
  onDatesChange() {},

  focusedInput: null,
  onFocusChange() {},
  onClose() {},

  keepOpenOnDateSelect: false,
  minimumNights: 1,
  isOutsideRange() {},
  isDayBlocked() {},
  isDayHighlighted() {},

  // DayPicker props
  enableOutsideDays: false,
  numberOfMonths: 1,
  orientation: HORIZONTAL_ORIENTATION,
  withPortal: false,

  initialVisibleMonth: DayPickerDefaultProps.initialVisibleMonth,
  daySize: DAY_SIZE,

  navPrev: null,
  navNext: null,

  onPrevMonthClick() {},
  onNextMonthClick() {},
  onOutsideClick() {},

  renderDay: null,
  renderCalendarInfo: null,

  // accessibility
  onBlur() {},
  isFocused: false,
  showKeyboardShortcuts: false,

  // i18n
  monthFormat: 'MMMM YYYY',
  phrases: DayPickerPhrases,
};

export default class DayPickerRangeController extends React.Component {
  constructor(props) {
    super(props);

    this.isTouchDevice = isTouchDevice();
    this.modifiers = {
      today: day => this.isToday(day),
      blocked: day => this.isBlocked(day),
      'blocked-calendar': day => props.isDayBlocked(day),
      'blocked-out-of-range': day => props.isOutsideRange(day),
      'highlighted-calendar': day => props.isDayHighlighted(day),
      valid: day => !this.isBlocked(day),
      'selected-start': day => this.isStartDate(day),
      'selected-end': day => this.isEndDate(day),
      'blocked-minimum-nights': day => this.doesNotMeetMinimumNights(day),
      'selected-span': day => this.isInSelectedSpan(day),
      'last-in-range': day => this.isLastInRange(day),
      hovered: day => this.isHovered(day),
      'hovered-span': day => this.isInHoveredSpan(day),
      'after-hovered-start': day => this.isDayAfterHoveredStartDate(day),
    };

    this.state = {
      hoverDate: null,
      visibleDays: this.getModifiers(props),
    };

    this.onDayClick = this.onDayClick.bind(this);
    this.onDayMouseEnter = this.onDayMouseEnter.bind(this);
    this.onDayMouseLeave = this.onDayMouseLeave.bind(this);
    this.onPrevMonthClick = this.onPrevMonthClick.bind(this);
    this.onNextMonthClick = this.onNextMonthClick.bind(this);
    this.getFirstFocusableDay = this.getFirstFocusableDay.bind(this);
  }

  componentWillReceiveProps(nextProps) {
    const { startDate, endDate, focusedInput, minimumNights } = nextProps;
    const { visibleDays } = this.state;

    const didStartDateChange = startDate !== this.props.startDate;
    const didEndDateChange = endDate !== this.props.endDate;
    const didFocusChange = focusedInput !== this.props.focusedInput;

    let modifiers = {};

    if (didStartDateChange) {
      modifiers = this.deleteModifier(modifiers, this.props.startDate, 'selected-start');
      modifiers = this.addModifier(modifiers, startDate, 'selected-start');
    }

    if (didEndDateChange) {
      modifiers = this.deleteModifier(modifiers, this.props.endDate, 'selected-end');
      modifiers = this.addModifier(modifiers, endDate, 'selected-end');
    }

    if (didStartDateChange || didEndDateChange) {
      if (this.props.startDate && this.props.endDate) {
        modifiers = this.deleteModifierFromRange(
          modifiers,
          this.props.startDate.clone().add(1, 'day'),
          this.props.endDate,
          'selected-span',
        );
      }

      if (startDate && endDate) {
        modifiers = this.deleteModifierFromRange(
          modifiers,
          startDate,
          endDate,
          'hovered-span',
        );

        modifiers = this.addModifierToRange(
          modifiers,
          startDate.clone().add(1, 'day'),
          endDate,
          'selected-span',
        );
      }
    }

    if (minimumNights > 0) {
      if (this.props.startDate && (didFocusChange || didStartDateChange)) {
        modifiers = this.deleteModifierFromRange(
          modifiers,
          this.props.startDate,
          this.props.startDate.clone().add(minimumNights, 'days'),
          'blocked-minimum-nights',
        );
      }

      if (startDate && focusedInput === END_DATE) {
        modifiers = this.addModifierToRange(
          modifiers,
          startDate,
          startDate.clone().add(minimumNights, 'days'),
          'blocked-minimum-nights',
        );
      }
    }

    if (didFocusChange) {
      // recalculate isDayBlocked
      // recalculate isDayHighlighted
      // ??? recalculate isOutsideRange
    }

    // has today changed?

    if (Object.keys(modifiers).length > 0) {
      this.setState({
        visibleDays: {
          ...visibleDays,
          ...modifiers,
        },
      });
    }
  }

  componentWillUpdate() {
    this.today = moment();
  }

  onDayClick(day, e) {
    const { keepOpenOnDateSelect, minimumNights, onBlur } = this.props;
    if (e) e.preventDefault();
    if (this.isBlocked(day)) return;

    const { focusedInput, onFocusChange, onClose } = this.props;
    let { startDate, endDate } = this.props;

    if (focusedInput === START_DATE) {
      onFocusChange(END_DATE);

      startDate = day;

      if (isInclusivelyAfterDay(day, endDate)) {
        endDate = null;
      }
    } else if (focusedInput === END_DATE) {
      const firstAllowedEndDate = startDate && startDate.clone().add(minimumNights, 'days');

      if (!startDate) {
        endDate = day;
        onFocusChange(START_DATE);
      } else if (isInclusivelyAfterDay(day, firstAllowedEndDate)) {
        endDate = day;
        if (!keepOpenOnDateSelect) {
          onFocusChange(null);
          onClose({ startDate, endDate });
        }
      } else {
        startDate = day;
        endDate = null;
      }
    }

    this.props.onDatesChange({ startDate, endDate });
    onBlur();
  }

  onDayMouseEnter(day) {
    if (this.isTouchDevice) return;
    const { startDate, endDate, focusedInput } = this.props;
    const { hoverDate, visibleDays } = this.state;

    let modifiers = {};
    modifiers = this.addModifier(modifiers, day, 'hovered');
    modifiers = this.deleteModifier(modifiers, hoverDate, 'hovered');

    if (startDate && !endDate && focusedInput === END_DATE) {
      if (isAfterDay(hoverDate, startDate)) {
        modifiers = this.deleteModifierFromRange(modifiers, startDate, hoverDate, 'hovered-span');
      }

      if (!this.isBlocked(day) && isAfterDay(day, startDate)) {
        modifiers = this.addModifierToRange(modifiers, startDate, day, 'hovered-span');
      }
    }

    if (!startDate && endDate && focusedInput === START_DATE) {
      if (isBeforeDay(hoverDate, endDate)) {
        modifiers = this.deleteModifierFromRange(modifiers, hoverDate, endDate, 'hovered-span');
      }

      if (!this.isBlocked(day) && isBeforeDay(day, endDate)) {
        modifiers = this.addModifierToRange(modifiers, day, endDate, 'hovered-span');
      }
    }

    this.setState({
      hoverDate: day,
      visibleDays: {
        ...visibleDays,
        ...modifiers,
      },
    });
  }

  onDayMouseLeave() {
    const { startDate, endDate } = this.props;
    const { hoverDate, visibleDays } = this.state;
    if (this.isTouchDevice || !hoverDate) return;

    if (hoverDate) {
      let modifiers = {};
      modifiers = this.deleteModifier(modifiers, hoverDate, 'hovered');

      if (startDate && !endDate && isAfterDay(hoverDate, startDate)) {
        modifiers = this.deleteModifierFromRange(modifiers, startDate, hoverDate, 'hovered-span');
      }

      if (!startDate && endDate && isAfterDay(endDate, hoverDate)) {
        modifiers = this.deleteModifierFromRange(modifiers, hoverDate, endDate, 'hovered-span');
      }

      this.setState({
        hoverDate: null,
        visibleDays: {
          ...visibleDays,
          ...modifiers,
        },
      });
    }
  }

  onPrevMonthClick() {
    const { onPrevMonthClick } = this.props;

    onPrevMonthClick();
  }

  onNextMonthClick() {
    const { onNextMonthClick } = this.props;

    onNextMonthClick();
  }

  getFirstFocusableDay(newMonth) {
    const { startDate, endDate, focusedInput, minimumNights, numberOfMonths } = this.props;

    let focusedDate = newMonth.clone().startOf('month');
    if (focusedInput === START_DATE && startDate) {
      focusedDate = startDate.clone();
    } else if (focusedInput === END_DATE && !endDate && startDate) {
      focusedDate = startDate.clone().add(minimumNights, 'days');
    } else if (focusedInput === END_DATE && endDate) {
      focusedDate = endDate.clone();
    }

    if (this.isBlocked(focusedDate)) {
      const days = [];
      const lastVisibleDay = newMonth.clone().add(numberOfMonths - 1, 'months').endOf('month');
      let currentDay = focusedDate.clone();
      while (!currentDay.isAfter(lastVisibleDay)) {
        currentDay = currentDay.clone().add(1, 'day');
        days.push(currentDay);
      }

      const viableDays = days.filter(day => !this.isBlocked(day) && day.isAfter(focusedDate));
      if (viableDays.length > 0) focusedDate = viableDays[0];
    }

    return focusedDate;
  }

  getModifiers(props) {
    const {
      numberOfMonths,
      enableOutsideDays,
      initialVisibleMonth,
    } = this.props || props;

    const currentMonth = initialVisibleMonth();
    const visibleDays = getVisibleDays(currentMonth, numberOfMonths, enableOutsideDays);

    const days = {};
    visibleDays.forEach((day) => {
      days[toISODateString(day)] = this.getModifiersForDay(day);
    });

    return days;
  }

  getModifiersForDay(day) {
    return new Set(Object.keys(this.modifiers).filter(modifier => this.modifiers[modifier](day)));
  }

  addModifier(updatedDays, day, modifier) {
    if (!day) return updatedDays;

    const { visibleDays } = this.state;

    const iso = toISODateString(day);
    const currentModifiers = updatedDays[iso] || new Set(visibleDays[iso]);
    currentModifiers.add(modifier);
    return {
      ...updatedDays,
      [iso]: currentModifiers,
    };
  }

  addModifierToRange(updatedDays, start, end, modifier) {
    let days = updatedDays;

    let spanStart = start.clone();
    while (isBeforeDay(spanStart, end)) {
      days = this.addModifier(days, spanStart, modifier);
      spanStart = spanStart.clone().add(1, 'day');
    }

    return days;
  }

  deleteModifier(updatedDays, day, modifier) {
    if (!day) return updatedDays;

    const { visibleDays } = this.state;

    const iso = toISODateString(day);
    const currentModifiers = updatedDays[iso] || new Set(visibleDays[iso]);
    currentModifiers.delete(modifier);
    return {
      ...updatedDays,
      [iso]: currentModifiers,
    };
  }

  deleteModifierFromRange(updatedDays, start, end, modifier) {
    let days = updatedDays;

    let spanStart = start.clone();
    while (isBeforeDay(spanStart, end)) {
      days = this.deleteModifier(days, spanStart, modifier);
      spanStart = spanStart.clone().add(1, 'day');
    }

    return days;
  }

  doesNotMeetMinimumNights(day) {
    const { startDate, isOutsideRange, focusedInput, minimumNights } = this.props;
    if (focusedInput !== END_DATE) return false;

    if (startDate) {
      const dayDiff = day.diff(startDate.clone().startOf('day').hour(12), 'days');
      return dayDiff < minimumNights && dayDiff >= 0;
    }
    return isOutsideRange(moment(day).subtract(minimumNights, 'days'));
  }

  isDayAfterHoveredStartDate(day) {
    const { startDate, endDate, minimumNights } = this.props;
    const { hoverDate } = this.state || {};
    return !!startDate && !endDate && !this.isBlocked(day) && isNextDay(hoverDate, day) &&
      minimumNights > 0 && isSameDay(hoverDate, startDate);
  }

  isEndDate(day) {
    return isSameDay(day, this.props.endDate);
  }

  isHovered(day) {
    const hoverDate = this.state || {};
    return isSameDay(day, hoverDate);
  }

  isInHoveredSpan(day) {
    const { startDate, endDate } = this.props;
    const { hoverDate } = this.state || {};

    const isForwardRange = !!startDate && !endDate &&
      (day.isBetween(startDate, hoverDate) ||
       isSameDay(hoverDate, day));
    const isBackwardRange = !!endDate && !startDate &&
      (day.isBetween(hoverDate, endDate) ||
       isSameDay(hoverDate, day));

    const isValidDayHovered = hoverDate && !this.isBlocked(hoverDate);

    return (isForwardRange || isBackwardRange) && isValidDayHovered;
  }

  isInSelectedSpan(day) {
    const { startDate, endDate } = this.props;
    return day.isBetween(startDate, endDate);
  }

  isLastInRange(day) {
    return this.isInSelectedSpan(day) && isNextDay(day, this.props.endDate);
  }

  isStartDate(day) {
    return isSameDay(day, this.props.startDate);
  }

  isBlocked(day) {
    const { isDayBlocked, isOutsideRange } = this.props;
    return isDayBlocked(day) || isOutsideRange(day) || this.doesNotMeetMinimumNights(day);
  }

  isToday(day) {
    return isSameDay(day, this.today);
  }

  render() {
    const {
      numberOfMonths,
      orientation,
      monthFormat,
      navPrev,
      navNext,
      onOutsideClick,
      onPrevMonthClick,
      onNextMonthClick,
      withPortal,
      enableOutsideDays,
      initialVisibleMonth,
      daySize,
      focusedInput,
      renderDay,
      renderCalendarInfo,
      onBlur,
      isFocused,
      showKeyboardShortcuts,
      phrases,
    } = this.props;

    const { visibleDays } = this.state;

    // set the appropriate CalendarDay phrase based on focusedInput
    let chooseAvailableDate = phrases.chooseAvailableDate;
    if (focusedInput === START_DATE) {
      chooseAvailableDate = phrases.chooseAvailableStartDate;
    } else if (focusedInput === END_DATE) {
      chooseAvailableDate = phrases.chooseAvailableEndDate;
    }

    const calendarDayPhrases = {
      ...phrases,
      chooseAvailableDate,
    };

    return (
      <DayPicker
        ref={(ref) => { this.dayPicker = ref; }}
        orientation={orientation}
        enableOutsideDays={enableOutsideDays}
        modifiers={visibleDays}
        numberOfMonths={numberOfMonths}
        onDayClick={this.onDayClick}
        onDayMouseEnter={this.onDayMouseEnter}
        onDayMouseLeave={this.onDayMouseLeave}
        onPrevMonthClick={this.onPrevMonthClick}
        onNextMonthClick={this.onNextMonthClick}
        monthFormat={monthFormat}
        withPortal={withPortal}
        hidden={!focusedInput}
        initialVisibleMonth={initialVisibleMonth}
        daySize={daySize}
        onOutsideClick={onOutsideClick}
        navPrev={navPrev}
        navNext={navNext}
        renderDay={renderDay}
        renderCalendarInfo={renderCalendarInfo}
        isFocused={isFocused}
        getFirstFocusableDay={this.getFirstFocusableDay}
        onBlur={onBlur}
        showKeyboardShortcuts={showKeyboardShortcuts}
        phrases={calendarDayPhrases}
      />
    );
  }
}

DayPickerRangeController.propTypes = propTypes;
DayPickerRangeController.defaultProps = defaultProps;
