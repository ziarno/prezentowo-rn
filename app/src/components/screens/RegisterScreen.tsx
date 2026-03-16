import { useFormik } from 'formik'
import { Link } from 'expo-router'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
} from 'react-native'
import * as Yup from 'yup'

import { useAuth } from '@/hooks/useAuth'

const validationSchema = Yup.object({
  name: Yup.string().required('Required'),
  email: Yup.string().email('Invalid email').required('Required'),
  password: Yup.string().min(6, 'At least 6 characters').required('Required'),
})

export function RegisterScreen() {
  const { register } = useAuth()

  const { values, errors, touched, handleChange, handleBlur, handleSubmit, isSubmitting, setErrors } =
    useFormik({
      initialValues: { name: '', email: '', password: '' },
      validationSchema,
      onSubmit: (values, { setSubmitting }) => {
        register({
          name: values.name,
          email: values.email,
          password: values.password,
          onError: err => {
            setErrors({ password: err.reason ?? err.error })
            setSubmitting(false)
          },
        })
      },
    })

  return (
    <KeyboardAvoidingView
      className="flex-1 justify-center bg-white px-6"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text className="text-3xl font-bold mb-8">Create account</Text>

      <TextInput
        className="border border-gray-200 rounded-lg p-4 mb-1 text-base"
        placeholder="Name"
        value={values.name}
        onChangeText={handleChange('name')}
        onBlur={handleBlur('name')}
        textContentType="name"
      />
      {touched.name && errors.name && (
        <Text className="text-red-500 text-sm mb-2">{errors.name}</Text>
      )}

      <TextInput
        className="border border-gray-200 rounded-lg p-4 mb-1 text-base"
        placeholder="Email"
        value={values.email}
        onChangeText={handleChange('email')}
        onBlur={handleBlur('email')}
        autoCapitalize="none"
        keyboardType="email-address"
        textContentType="emailAddress"
      />
      {touched.email && errors.email && (
        <Text className="text-red-500 text-sm mb-2">{errors.email}</Text>
      )}

      <TextInput
        className="border border-gray-200 rounded-lg p-4 mb-1 text-base"
        placeholder="Password"
        value={values.password}
        onChangeText={handleChange('password')}
        onBlur={handleBlur('password')}
        secureTextEntry
        textContentType="newPassword"
      />
      {touched.password && errors.password && (
        <Text className="text-red-500 text-sm mb-2">{errors.password}</Text>
      )}

      <Pressable
        className="bg-[#208AEF] rounded-lg p-4 items-center mt-2"
        onPress={() => handleSubmit()}
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="text-white text-base font-semibold">Create account</Text>
        )}
      </Pressable>

      <Link href="/login" className="mt-6 text-center text-[#208AEF]">
        Already have an account? Sign in
      </Link>
    </KeyboardAvoidingView>
  )
}
