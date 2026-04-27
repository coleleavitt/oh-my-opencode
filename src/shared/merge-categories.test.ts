import { describe, it, expect } from "bun:test"
import { mergeCategories } from "./merge-categories"
import { DEFAULT_CATEGORIES } from "../tools/delegate-task/constants"

describe("mergeCategories", () => {
  it("returns all default categories when no user config provided", () => {
    //#given
    const userCategories = undefined

    //#when
    const result = mergeCategories(userCategories)

    //#then
    expect(Object.keys(result)).toEqual(Object.keys(DEFAULT_CATEGORIES))
  })

  it("filters out categories with disable: true", () => {
    const userCategories = {
      "writing": { disable: true },
    }

    const result = mergeCategories(userCategories)

    expect(result["writing"]).toBeUndefined()
    expect(Object.keys(result).length).toBe(Object.keys(DEFAULT_CATEGORIES).length - 1)
  })

  it("keeps categories with disable: false", () => {
    const userCategories = {
      "writing": { disable: false },
    }

    const result = mergeCategories(userCategories)

    expect(result["writing"]).toBeDefined()
  })

  it("allows user to add custom categories", () => {
    //#given
    const userCategories = {
      "my-custom": { model: "openai/gpt-5.4", description: "Custom category" },
    }

    //#when
    const result = mergeCategories(userCategories)

    //#then
    expect(result["my-custom"]).toBeDefined()
    expect(result["my-custom"].model).toBe("openai/gpt-5.4")
  })

  it("allows user to disable custom categories", () => {
    //#given
    const userCategories = {
      "my-custom": { model: "openai/gpt-5.4", disable: true },
    }

    //#when
    const result = mergeCategories(userCategories)

    //#then
    expect(result["my-custom"]).toBeUndefined()
  })

  it("user overrides merge with defaults", () => {
    //#given
    const userCategories = {
      "visual-engineering": { model: "anthropic/claude-opus-4-6" },
    }

    //#when
    const result = mergeCategories(userCategories)

    //#then
    expect(result["visual-engineering"]).toBeDefined()
    expect(result["visual-engineering"].model).toBe("anthropic/claude-opus-4-6")
  })
})
