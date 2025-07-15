# In-Progress Encounters Alert Component

## Overview
React Native component that displays alerts for practitioners when they have active encounters requiring attention.

## Related Documents
- [Mobile API Integration](./MOBILE-API-INTEGRATION.md)
- [Mobile Testing Procedures](./MOBILE-TESTING-PROCEDURES.md)

## Component Details

### File Location
`/src/components/common/InProgressEncountersAlert.tsx`

### Component Features
- **Portuguese Language Support**: "Você possui X encontro(s) em andamento!"
- **Conditional Rendering**: Hidden when encounter count is 0
- **Professional Styling**: Warning-style design with medical icons
- **Touch Navigation**: Tapping navigates to encounter list
- **Responsive Design**: Optimized for mobile devices

### Visual Design
- **Alert Banner Style**: Prominent warning appearance
- **Icon Integration**: Medical icons for visual context
- **Count Display**: Clear numerical indicator
- **Touch Feedback**: Visual feedback on interaction

## Technical Implementation

### Component Props
```typescript
interface InProgressEncountersAlertProps {
  encounterCount: number;
  onPress: () => void;
  practitionerId: string;
}
```

### State Management
- **Encounter Count**: Real-time count from API
- **Loading State**: Shows loading indicator while fetching
- **Error State**: Fallback display on API errors
- **Refresh State**: Pull-to-refresh integration

### Integration Points

#### Dashboard Integration
- **Location**: `/src/screens/Dashboard/DashboardScreen.tsx`
- **Placement**: Prominent position at top of dashboard
- **Behavior**: Updates on dashboard refresh

#### Navigation Integration
- **Target**: Encounter list screen
- **Transition**: Smooth navigation animation
- **Context**: Preserves dashboard context

## User Experience

### Interaction Flow
1. **Alert Display**: Component shows when encounters > 0
2. **User Tap**: Practitioner taps alert banner
3. **Navigation**: Smooth transition to encounter list
4. **Return**: Back navigation preserves dashboard state

### Accessibility
- **Screen Reader**: Full VoiceOver/TalkBack support
- **Touch Target**: Meets minimum touch target size
- **Color Contrast**: WCAG compliant color scheme
- **Dynamic Text**: Supports iOS Dynamic Type

## Performance Optimization

### Rendering
- **Conditional Rendering**: Only renders when needed
- **Memoization**: Prevents unnecessary re-renders
- **Lazy Loading**: Efficient resource usage
- **Animation**: Smooth 60fps animations

### Memory Management
- **Component Cleanup**: Proper unmounting
- **Event Listeners**: Automatic cleanup
- **API Calls**: Request cancellation on unmount

## Styling

### Theme Integration
```typescript
const styles = StyleSheet.create({
  alertContainer: {
    backgroundColor: theme.colors.warning,
    padding: theme.spacing.medium,
    borderRadius: theme.borderRadius.medium,
    margin: theme.spacing.small,
  },
  // ... other styles
});
```

### Responsive Design
- **Screen Size Adaptation**: Adjusts to different screen sizes
- **Orientation Support**: Portrait and landscape modes
- **Density Independence**: Consistent across device densities

## Next Steps
- Review [Mobile API Integration](./MOBILE-API-INTEGRATION.md) for data flow
- Check [Mobile Testing Procedures](./MOBILE-TESTING-PROCEDURES.md) for testing approach