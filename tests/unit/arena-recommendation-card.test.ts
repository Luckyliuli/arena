// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import ArenaRecommendationCard from '../../src/renderer/components/ArenaRecommendationCard.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  messages: {
    'zh-CN': {
      augment: {
        priority: '优先级',
        winRate: '胜率',
        pickRateShort: '选用率',
        noStats: '暂无统计',
        notRecommendedForChampion: '不适配',
        scoreStrong: '强烈推荐',
        scoreUnknown: '未知',
      },
    },
  },
})

function factory(props: Record<string, unknown>) {
  return mount(ArenaRecommendationCard, {
    props,
    global: { plugins: [i18n] },
  })
}

describe('ArenaRecommendationCard', () => {
  it('puts the recommendation score in the main visual position', () => {
    const wrapper = factory({
      name: '暗钢利爪',
      recommendScore: 0.82,
      recommendationTier: 'strong',
      winRate: 0.58,
      pickRate: 0.1,
    })
    expect(wrapper.get('.score-hero strong').text()).toBe('82')
    expect(wrapper.text()).toContain('强烈推荐')
    expect(wrapper.text()).toContain('58.0%')
    wrapper.unmount()
  })

  it('keeps an item with no statistics visible', () => {
    const wrapper = factory({ name: '无统计装备', recommendScore: null })
    expect(wrapper.text()).toContain('无统计装备')
    expect(wrapper.text()).toContain('暂无统计')
    expect(wrapper.find('.score-hero').exists()).toBe(false)
    wrapper.unmount()
  })
})
