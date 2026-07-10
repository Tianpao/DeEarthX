package util

import (
	"context"
	"fmt"
	"sync"
	"time"
)

// ConcurrentMap executes a function concurrently on a slice of items
// with a maximum concurrency limit
func ConcurrentMap[T any, R any](ctx context.Context, items []T, fn func(T) (R, error), concurrency int) ([]R, error) {
	if len(items) == 0 {
		return nil, nil
	}

	sem := make(chan struct{}, concurrency)
	results := make([]R, len(items))
	errs := make([]error, len(items))
	var wg sync.WaitGroup

	for i, item := range items {
		wg.Add(1)
		go func(idx int, val T) {
			defer wg.Done()

			// Acquire semaphore
			select {
			case sem <- struct{}{}:
				defer func() { <-sem }()
			case <-ctx.Done():
				errs[idx] = ctx.Err()
				return
			}

			results[idx], errs[idx] = fn(val)
		}(i, item)
	}

	wg.Wait()

	// Check for errors
	for _, err := range errs {
		if err != nil {
			return nil, err
		}
	}

	return results, nil
}

// Retry executes a function with retry and exponential backoff
func Retry(attempts int, initialDelay time.Duration, fn func() error) error {
	var err error
	delay := initialDelay

	for i := 0; i < attempts; i++ {
		err = fn()
		if err == nil {
			return nil
		}

		if i < attempts - 1 {
			time.Sleep(delay)
			delay *= 2 // Exponential backoff
			if delay > 60*time.Second {
				delay = 60 * time.Second // Cap at 60 seconds
			}
		}
	}

	return fmt.Errorf("after %d attempts: %w", attempts, err)
}

// RetryWithContext executes a function with retry and context support
func RetryWithContext(ctx context.Context, attempts int, initialDelay time.Duration, fn func() error) error {
	var err error
	delay := initialDelay

	for i := 0; i < attempts; i++ {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		err = fn()
		if err == nil {
			return nil
		}

		if i < attempts - 1 {
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(delay):
			}
			delay *= 2
			if delay > 60*time.Second {
				delay = 60 * time.Second
			}
		}
	}

	return fmt.Errorf("after %d attempts: %w", attempts, err)
}

// Semaphore is a simple semaphore implementation
type Semaphore struct {
	sem chan struct{}
}

// NewSemaphore creates a new semaphore with given capacity
func NewSemaphore(capacity int) *Semaphore {
	return &Semaphore{
		sem: make(chan struct{}, capacity),
	}
}

// Acquire acquires a slot in the semaphore
func (s *Semaphore) Acquire(ctx context.Context) error {
	select {
	case s.sem <- struct{}{}:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

// Release releases a slot in the semaphore
func (s *Semaphore) Release() {
	<-s.sem
}