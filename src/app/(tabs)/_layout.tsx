import { Tabs } from 'expo-router';

import { TabIcon } from '@/components/TabIcon';
import { useCategoryCheckPrompt } from '@/hooks/useCategoryCheckPrompt';
import { colors, fontFamily } from '@/theme';

export default function TabsLayout() {
  useCategoryCheckPrompt();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.subtle,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.line, height: 80, paddingTop: 8 },
        tabBarItemStyle: { gap: 4 },
        tabBarLabelStyle: { fontFamily, fontSize: 12, fontWeight: '700' },
        headerStyle: { backgroundColor: colors.bg },
        headerShadowVisible: false,
        headerTitleStyle: { fontFamily, fontWeight: '700', color: colors.ink },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          headerShown: false,
          tabBarIcon: ({ color, focused }) => <TabIcon name="bar_chart" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: 'Transactions',
          headerShown: false,
          tabBarIcon: ({ color, focused }) => <TabIcon name="receipt_long" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          headerShown: false,
          tabBarIcon: ({ color, focused }) => <TabIcon name="settings" color={color} focused={focused} />,
        }}
      />
    </Tabs>
  );
}
