# Mobile Testing Procedures

## Overview
Comprehensive testing strategy and procedures for the mobile application, including current testing gaps and implementation roadmap.

## Related Documents
- [Mobile Development Tasks](./MOBILE-DEVELOPMENT-TASKS.md)
- [Mobile API Integration](./MOBILE-API-INTEGRATION.md)
- [Encounters Alert Component](./ENCOUNTERS-ALERT-COMPONENT.md)

---

## 🚨 CURRENT TESTING STATUS

### Critical Issues
- ❌ **Zero test files found** in the entire codebase
- ❌ No testing configuration (Jest, React Native Testing Library)
- ❌ No CI/CD testing pipeline
- ❌ No test coverage reporting
- ❌ No mock server for API testing

### Risk Assessment
**Current Risk Level:** 🔴 **CRITICAL**
- No automated regression testing
- High probability of breaking existing features
- No validation of critical user flows
- No API integration testing

---

## 📋 TESTING IMPLEMENTATION ROADMAP

### Phase 1: Foundation Setup (Week 1)

#### 1. Testing Framework Installation
```bash
# Install testing dependencies
npm install --save-dev @testing-library/react-native @testing-library/jest-native jest-expo
npm install --save-dev @types/jest detox
```

#### 2. Configuration Files Setup

**jest.config.js:**
```javascript
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest-setup.js'],
  testMatch: ['**/__tests__/**/*.(ts|tsx|js|jsx)', '**/*.(test|spec).(ts|tsx|js|jsx)'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.test.{ts,tsx}',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};
```

**jest-setup.js:**
```javascript
import '@testing-library/jest-native/extend-expect';
import 'react-native-gesture-handler/jestSetup';
```

#### 3. Mock Setup
**src/tests/mocks/:**
- `AsyncStorage.mock.ts` - AsyncStorage mocking
- `api.mock.ts` - API service mocking
- `navigation.mock.ts` - Navigation mocking

### Phase 2: Critical Component Testing (Week 2)

#### 1. Authentication Store Tests
**File:** `src/store/__tests__/authStore.test.ts`

```typescript
import { authStore } from '../authStore';
import AsyncStorage from '@react-native-async-storage/async-storage';

describe('AuthStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authStore.logout();
  });

  test('should login successfully with valid credentials', async () => {
    // Mock API response
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        token: 'test-token',
        user: { id: 1, email: 'test@example.com' }
      })
    });

    await authStore.login('test@example.com', 'password');
    
    expect(authStore.isAuthenticated).toBe(true);
    expect(authStore.user.email).toBe('test@example.com');
  });

  test('should handle login failure gracefully', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 401
    });

    await expect(authStore.login('invalid@example.com', 'wrong')).rejects.toThrow();
    expect(authStore.isAuthenticated).toBe(false);
  });

  test('should refresh token automatically', async () => {
    // Test token refresh logic once implemented
  });
});
```

#### 2. API Service Tests
**File:** `src/services/__tests__/api.test.ts`

```typescript
import { apiService } from '../api';
import { authStore } from '../../store/authStore';

describe('API Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should include organization header in requests', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] })
    });
    global.fetch = mockFetch;

    await apiService.getInProgressEncounters('practitioner-id');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          'organization': expect.any(String)
        })
      })
    );
  });

  test('should handle 401 responses with token refresh', async () => {
    // Test token refresh flow
  });
});
```

#### 3. Component Tests
**File:** `src/components/common/__tests__/InProgressEncountersAlert.test.tsx`

```typescript
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { InProgressEncountersAlert } from '../InProgressEncountersAlert';

describe('InProgressEncountersAlert', () => {
  test('should render when encounterCount > 0', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <InProgressEncountersAlert 
        encounterCount={3} 
        onPress={onPress}
        practitionerId="test-id"
      />
    );

    expect(getByText(/3 encontro\(s\) em andamento/)).toBeTruthy();
  });

  test('should not render when encounterCount is 0', () => {
    const onPress = jest.fn();
    const { queryByText } = render(
      <InProgressEncountersAlert 
        encounterCount={0} 
        onPress={onPress}
        practitionerId="test-id"
      />
    );

    expect(queryByText(/encontro/)).toBeNull();
  });

  test('should call onPress when tapped', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <InProgressEncountersAlert 
        encounterCount={2} 
        onPress={onPress}
        practitionerId="test-id"
      />
    );

    fireEvent.press(getByTestId('encounters-alert'));
    expect(onPress).toHaveBeenCalled();
  });
});
```

### Phase 3: Screen Integration Tests (Week 3)

#### 1. Login Screen Tests
**File:** `src/screens/Auth/__tests__/LoginScreen.test.tsx`

```typescript
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { LoginScreen } from '../LoginScreen';
import { authStore } from '../../../store/authStore';

describe('LoginScreen', () => {
  test('should login successfully with valid credentials', async () => {
    const { getByPlaceholderText, getByText } = render(<LoginScreen />);
    
    const emailInput = getByPlaceholderText('Email');
    const passwordInput = getByPlaceholderText('Senha');
    const loginButton = getByText('Entrar');

    fireEvent.changeText(emailInput, 'test@example.com');
    fireEvent.changeText(passwordInput, 'password123');
    fireEvent.press(loginButton);

    await waitFor(() => {
      expect(authStore.isAuthenticated).toBe(true);
    });
  });

  test('should show error message on login failure', async () => {
    // Test error handling
  });
});
```

#### 2. Dashboard Screen Tests
**File:** `src/screens/Dashboard/__tests__/DashboardScreen.test.tsx`

```typescript
import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { DashboardScreen } from '../DashboardScreen';

describe('DashboardScreen', () => {
  test('should display encounters alert when encounters exist', async () => {
    // Mock API to return encounters
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ id: 1 }, { id: 2 }] })
    });

    const { getByText } = render(<DashboardScreen />);

    await waitFor(() => {
      expect(getByText(/2 encontro\(s\) em andamento/)).toBeTruthy();
    });
  });

  test('should handle API error gracefully', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

    const { getByText } = render(<DashboardScreen />);

    await waitFor(() => {
      // Should fallback to mock data or show error
      expect(getByText(/erro/i)).toBeTruthy();
    });
  });
});
```

### Phase 4: End-to-End Testing (Week 4)

#### 1. Detox E2E Setup
**detox.config.js:**
```javascript
module.exports = {
  testRunner: 'jest',
  runnerConfig: 'e2e/config.json',
  configurations: {
    'ios.sim.debug': {
      binaryPath: 'ios/build/Build/Products/Debug-iphonesimulator/MedPro.app',
      build: 'xcodebuild -workspace ios/MedPro.xcworkspace -scheme MedPro -configuration Debug -sdk iphonesimulator -derivedDataPath ios/build',
      type: 'ios.simulator',
      device: {
        type: 'iPhone 12'
      }
    }
  }
};
```

#### 2. Critical User Flows
**e2e/loginFlow.e2e.js:**
```javascript
describe('Login Flow', () => {
  beforeEach(async () => {
    await device.reloadReactNative();
  });

  test('should login and navigate to dashboard', async () => {
    await element(by.id('email-input')).typeText('test@example.com');
    await element(by.id('password-input')).typeText('password123');
    await element(by.id('login-button')).tap();
    
    await expect(element(by.id('dashboard-screen'))).toBeVisible();
  });

  test('should show encounters alert on dashboard', async () => {
    // Login first
    await element(by.id('email-input')).typeText('test@example.com');
    await element(by.id('password-input')).typeText('password123');
    await element(by.id('login-button')).tap();
    
    // Check encounters alert
    await expect(element(by.id('encounters-alert'))).toBeVisible();
  });
});
```

---

## 🔧 TESTING INFRASTRUCTURE

### Mock Server Setup
**File:** `src/tests/mocks/server.ts`

```typescript
import { setupServer } from 'msw/node';
import { rest } from 'msw';

const handlers = [
  rest.post('/login', (req, res, ctx) => {
    return res(
      ctx.json({
        token: 'mock-token',
        user: { id: 1, email: 'test@example.com' }
      })
    );
  }),

  rest.get('/encounter/getencounters/practitioner/:id', (req, res, ctx) => {
    return res(
      ctx.json({
        data: [
          { id: 1, status: 'in-progress' },
          { id: 2, status: 'in-progress' }
        ]
      })
    );
  }),
];

export const server = setupServer(...handlers);
```

### Continuous Integration
**.github/workflows/test.yml:**
```yaml
name: Test Mobile App

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        
    - name: Install dependencies
      run: npm ci
      
    - name: Run tests
      run: npm test -- --coverage
      
    - name: Upload coverage
      uses: codecov/codecov-action@v3
```

---

## 📊 TESTING METRICS & TARGETS

### Coverage Targets
- **Unit Tests:** 90% line coverage
- **Integration Tests:** 80% of critical user flows
- **E2E Tests:** 100% of primary user journeys

### Performance Targets
- **Test Execution:** < 30 seconds for unit tests
- **E2E Tests:** < 5 minutes for full suite
- **CI Pipeline:** < 10 minutes total

### Quality Targets
- **Zero flaky tests:** 99.5% test stability
- **Test Maintainability:** Clear, readable test descriptions
- **Mock Accuracy:** API mocks match real backend behavior

---

## 🎯 TESTING CHECKLIST

### Foundation (Week 1)
- [ ] Install testing framework (Jest + React Native Testing Library)
- [ ] Setup test configuration and scripts
- [ ] Create mock utilities for AsyncStorage, API, Navigation
- [ ] Setup CI/CD pipeline for automated testing

### Unit Tests (Week 2)
- [ ] AuthStore tests (login, logout, token refresh)
- [ ] API service tests (all endpoints, error handling)
- [ ] Component tests (InProgressEncountersAlert, key components)
- [ ] Navigation tests (route handling, params)

### Integration Tests (Week 3)
- [ ] Login screen flow tests
- [ ] Dashboard data loading tests
- [ ] Navigation between screens tests
- [ ] API error handling integration tests

### E2E Tests (Week 4)
- [ ] Setup Detox for E2E testing
- [ ] Critical user journey tests (login → dashboard → features)
- [ ] Error scenario tests (network failures, invalid data)
- [ ] Performance and memory usage tests

### Quality Assurance
- [ ] Achieve 90%+ test coverage
- [ ] All tests pass consistently
- [ ] Test documentation and maintenance guides
- [ ] Performance benchmarks established

**Total Estimated Effort:** 60-80 hours for comprehensive testing implementation