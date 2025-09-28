import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createMockCaseDisplay } from '@/src/test/testUtils'

describe('Testing Setup', () => {
  it('should be able to create mock data', () => {
    const mockCase = createMockCaseDisplay()
    
    expect(mockCase).toBeDefined()
    expect(mockCase.id).toBe('case-test-1')
    expect(mockCase.person.firstName).toBe('John')
    expect(mockCase.person.lastName).toBe('Doe')
  expect(mockCase.caseRecord.status).toBe('Pending')
  })

  it('should be able to render a simple component', () => {
    const TestComponent = () => <div data-testid="test">Hello World</div>
    
    render(<TestComponent />)
    
    expect(screen.getByTestId('test')).toBeInTheDocument()
    expect(screen.getByText('Hello World')).toBeInTheDocument()
  })

  it('should have access to testing utilities', () => {
    expect(render).toBeDefined()
    expect(screen).toBeDefined()
  })
})